-- ============================================================
-- 0007_features_updates.sql
-- Phase 7: Order Ratings + Notification Preferences +
--          Admin Read State + Preferred Cook + App Settings
-- ============================================================

-- ── 1. Add preferred_cook_id to profiles ─────────────────────
alter table public.profiles
  add column if not exists preferred_cook_id uuid references public.cooks(id) on delete set null;

-- ── 2. notification_preferences ──────────────────────────────
create table if not exists public.notification_preferences (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  notify_specials  boolean not null default true,
  notify_orders    boolean not null default true,
  notify_chat      boolean not null default true,
  notify_promos    boolean not null default true,
  target_cities    text[],  -- null = all cities; populate for geographic segmentation
  updated_at       timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "np_select_own" on public.notification_preferences;
create policy "np_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "np_write_own" on public.notification_preferences;
create policy "np_write_own" on public.notification_preferences
  for all using (auth.uid() = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

-- ── 3. order_ratings ─────────────────────────────────────────
create table if not exists public.order_ratings (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null unique references public.orders(id) on delete cascade,
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  cook_id         uuid references public.cooks(id) on delete set null,
  food_rating     integer not null check (food_rating between 1 and 5),
  delivery_rating integer not null check (delivery_rating between 1 and 5),
  overall_rating  integer not null check (overall_rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);

create index if not exists order_ratings_customer_idx on public.order_ratings(customer_id);
create index if not exists order_ratings_cook_idx     on public.order_ratings(cook_id);

alter table public.order_ratings enable row level security;

drop policy if exists "ratings_select" on public.order_ratings;
create policy "ratings_select" on public.order_ratings
  for select using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "ratings_insert_own" on public.order_ratings;
create policy "ratings_insert_own" on public.order_ratings
  for insert with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.orders
      where id = order_id
        and customer_id = auth.uid()
        and status = 'delivered'
    )
  );

grant select, insert on public.order_ratings to authenticated;

-- ── 4. admin_read_state ───────────────────────────────────────
create table if not exists public.admin_read_state (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles(id) on delete cascade,
  section      text not null check (section in ('orders', 'chat', 'notifications', 'users')),
  last_read_at timestamptz not null default now(),
  unread_count integer not null default 0,
  unique (admin_id, section)
);

alter table public.admin_read_state enable row level security;

drop policy if exists "ars_admin_own" on public.admin_read_state;
create policy "ars_admin_own" on public.admin_read_state
  for all using (auth.uid() = admin_id and public.is_admin());

grant select, insert, update on public.admin_read_state to authenticated;

-- ── 5. App Settings — new defaults ───────────────────────────
insert into public.app_settings (key, value, description) values
  ('preferred_cook_bonus',       '200',  'نقاط مكافأة إضافية للطاهي المفضل في خوارزمية التوزيع'),
  ('rating_reminder_delay_mins', '60',   'دقائق الانتظار قبل إرسال إشعار تذكير التقييم'),
  ('new_special_notify_enabled', 'true', 'هل يتم إخطار العملاء بعروض اليوم الجديدة')
on conflict (key) do nothing;

-- ── 6. Trigger: Update cook rating on new review ──────────────
create or replace function public.update_cook_rating_on_review()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.cook_id is not null then
    update public.cooks
       set rating = (
             select round(avg(overall_rating)::numeric, 2)
               from public.order_ratings
              where cook_id = new.cook_id
           )
     where id = new.cook_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_update_cook_rating on public.order_ratings;
create trigger trg_update_cook_rating
  after insert on public.order_ratings
  for each row execute function public.update_cook_rating_on_review();

-- ── 7. Trigger: Notify users of new Today Special ────────────
-- Instead of calling HTTP directly, we insert into notifications table.
-- Supabase Database Webhook on notifications INSERT fires send-push-notification Edge Function.
create or replace function public.notify_new_today_special()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_enabled text;
begin
  -- Check if new special notifications are enabled
  select value into v_enabled
    from public.app_settings
   where key = 'new_special_notify_enabled';

  if coalesce(v_enabled, 'true') <> 'true' then
    return new;
  end if;

  -- Insert notification row for every customer who wants specials
  insert into public.notifications (user_id, title, body, type, is_read)
  select p.id,
         'عرض جديد متاح الآن! 🍽️',
         'جرّب ' || new.title || ' بسعر ' || new.price || ' جنيه فقط. محدود!',
         'promotion',
         false
    from public.profiles p
    join public.notification_preferences np on np.user_id = p.id
   where p.role = 'customer'
     and p.status = 'active'
     and np.notify_specials = true
     -- Geographic segmentation: skip if user has target_cities set and does not include the restaurant city
     and (np.target_cities is null or array_length(np.target_cities, 1) is null);

  return new;
end;
$$;

drop trigger if exists trg_new_special_notification on public.available_today;
create trigger trg_new_special_notification
  after insert on public.available_today
  for each row
  when (new.is_active = true)
  execute function public.notify_new_today_special();

-- ── 8. Helper view: cook_performance ─────────────────────────
create or replace view public.cook_performance as
select
  c.id,
  c.full_name,
  c.status,
  c.rating,
  c.completed_orders,
  c.average_preparation_time,
  coalesce(avg_r.avg_food,     0) as avg_food_rating,
  coalesce(avg_r.avg_delivery, 0) as avg_delivery_rating,
  coalesce(avg_r.avg_overall,  0) as avg_overall_rating,
  coalesce(avg_r.review_count, 0) as review_count,
  coalesce(pc.preferred_count, 0) as preferred_count,
  coalesce(rc.returning_customers, 0) as returning_customers
from public.cooks c
left join lateral (
  select
    round(avg(food_rating)::numeric,     2) as avg_food,
    round(avg(delivery_rating)::numeric,  2) as avg_delivery,
    round(avg(overall_rating)::numeric,   2) as avg_overall,
    count(*) as review_count
  from public.order_ratings where cook_id = c.id
) avg_r on true
left join lateral (
  select count(*) as preferred_count
  from public.profiles where preferred_cook_id = c.id
) pc on true
left join lateral (
  select count(distinct customer_id) filter (where order_count > 1) as returning_customers
  from (
    select customer_id, count(*) as order_count
    from public.orders
    where cook_id = c.id and status = 'delivered'
    group by customer_id
  ) sub
) rc on true;

grant select on public.cook_performance to authenticated;

-- ── 9. Add favorites_count to meals + trigger to sync ─────────
alter table public.meals add column if not exists favorites_count integer not null default 0;

update public.meals m
   set favorites_count = (select count(*) from public.favorites where meal_id = m.id);

create or replace function public.update_meals_favorites_count()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.meals
       set favorites_count = favorites_count + 1
     where id = new.meal_id;
  elsif tg_op = 'DELETE' then
    update public.meals
       set favorites_count = greatest(0, favorites_count - 1)
     where id = old.meal_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_update_meals_favorites_count on public.favorites;
create trigger trg_update_meals_favorites_count
  after insert or delete on public.favorites
  for each row execute function public.update_meals_favorites_count();

