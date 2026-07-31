-- ============================================================
-- 0009_review_moderation_variants.sql (v3 - 100% Idempotent Production Migration)
-- Product Variants, Extras, Soft Delete, Stock Tracking, Pinned Order & Review Moderation
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLES (Base Structures)
-- ────────────────────────────────────────────────────────────

create table if not exists public.meal_variants (
  id      uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  name    text not null
);

create table if not exists public.meal_variant_extras (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.meal_variants(id) on delete cascade,
  name       text not null
);

create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  event_name text not null,
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 2. ALTER TABLES (Add Columns idempotently)
-- ────────────────────────────────────────────────────────────

-- meal_variants columns
alter table public.meal_variants
  add column if not exists description                 text,
  add column if not exists image_url                   text,
  add column if not exists price                       numeric(10, 2) not null default 0 check (price >= 0),
  add column if not exists estimated_preparation_time   integer,
  add column if not exists is_available                boolean not null default true,
  add column if not exists is_default                 boolean not null default false,
  add column if not exists display_order              integer not null default 0,
  add column if not exists track_stock                boolean not null default false,
  add column if not exists stock_count                integer default null,
  add column if not exists is_deleted                 boolean not null default false,
  add column if not exists created_at                  timestamptz not null default now(),
  add column if not exists updated_at                  timestamptz not null default now();

-- meal_variant_extras columns
alter table public.meal_variant_extras
  add column if not exists price         numeric(10, 2) not null default 0 check (price >= 0),
  add column if not exists is_available  boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists is_deleted    boolean not null default false,
  add column if not exists created_at    timestamptz not null default now(),
  add column if not exists updated_at    timestamptz not null default now();

-- meals columns
alter table public.meals
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_deleted boolean not null default false;

-- order_items columns
alter table public.order_items
  add column if not exists variant_id      uuid references public.meal_variants(id) on delete set null,
  add column if not exists variant_name    text,
  add column if not exists selected_extras jsonb;

-- reviews columns
alter table public.reviews
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pin_order integer default 0;

-- ────────────────────────────────────────────────────────────
-- 3. CONSTRAINTS (Safe Re-creation)
-- ────────────────────────────────────────────────────────────

do $$
declare
  r record;
begin
  for r in (
    select conname
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
     where t.relname = 'reviews' and c.contype = 'c' and c.conname like '%status%'
  ) loop
    execute 'alter table public.reviews drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end;
$$;

alter table public.reviews add constraint reviews_status_check check (status in ('pending', 'approved', 'rejected', 'hidden'));

-- ────────────────────────────────────────────────────────────
-- 4. INDEXES (Conditional Creation)
-- ────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meal_variants' and column_name = 'meal_id'
  ) then
    create index if not exists meal_variants_meal_idx on public.meal_variants(meal_id);
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meal_variants' and column_name = 'is_available'
  ) then
    create index if not exists meal_variants_available_idx on public.meal_variants(is_available) where is_deleted = false;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meal_variants' and column_name = 'display_order'
  ) then
    create index if not exists meal_variants_order_idx on public.meal_variants(display_order);
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meal_variant_extras' and column_name = 'variant_id'
  ) then
    create index if not exists meal_variant_extras_variant_idx on public.meal_variant_extras(variant_id);
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'analytics_events' and column_name = 'user_id'
  ) then
    create index if not exists analytics_events_user_idx on public.analytics_events(user_id);
    create index if not exists analytics_events_name_idx on public.analytics_events(event_name);
  end if;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 5. POLICIES & RLS (Drop If Exists -> Create)
-- ────────────────────────────────────────────────────────────

alter table public.meal_variants enable row level security;
alter table public.meal_variant_extras enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "meal_variants_select" on public.meal_variants;
create policy "meal_variants_select" on public.meal_variants
  for select using ((is_available = true and is_deleted = false) or public.is_admin());

drop policy if exists "meal_variants_admin" on public.meal_variants;
create policy "meal_variants_admin" on public.meal_variants
  for all using (public.is_admin());

drop policy if exists "meal_variant_extras_select" on public.meal_variant_extras;
create policy "meal_variant_extras_select" on public.meal_variant_extras
  for select using ((is_available = true and is_deleted = false) or public.is_admin());

drop policy if exists "meal_variant_extras_admin" on public.meal_variant_extras;
create policy "meal_variant_extras_admin" on public.meal_variant_extras
  for all using (public.is_admin());

drop policy if exists "analytics_insert" on public.analytics_events;
create policy "analytics_insert" on public.analytics_events for insert with check (true);

drop policy if exists "analytics_select_admin" on public.analytics_events;
create policy "analytics_select_admin" on public.analytics_events for select using (public.is_admin());

grant select, insert, update, delete on public.meal_variants to authenticated;
grant select, insert, update, delete on public.meal_variant_extras to authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;

-- Storage buckets & policies
insert into storage.buckets (id, name, public)
values ('category-images', 'category-images', true),
       ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "Public Access Images" on storage.objects;
create policy "Public Access Images" on storage.objects
  for select using (bucket_id in ('category-images', 'meal-images'));

drop policy if exists "Admin Upload Images" on storage.objects;
create policy "Admin Upload Images" on storage.objects
  for insert with check (bucket_id in ('category-images', 'meal-images') and public.is_admin());

drop policy if exists "Admin Update Images" on storage.objects;
create policy "Admin Update Images" on storage.objects
  for update using (bucket_id in ('category-images', 'meal-images') and public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 6. APP SETTINGS DEFAULTS
-- ────────────────────────────────────────────────────────────

insert into public.app_settings (key, value, description) values
  ('business_phone',   '"01000000000"', 'رقم هاتف التواصل للعمل'),
  ('whatsapp_number',  '"201000000000"', 'رقم الواتساب لاستقبال استفسارات العملاء'),
  ('facebook_url',     '""', 'رابط صفحة فيسبوك'),
  ('instagram_url',    '""', 'رابط حساب إنستجرام'),
  ('tiktok_url',       '""', 'رابط حساب تيك توك')
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────────
-- 7. FUNCTIONS
-- ────────────────────────────────────────────────────────────

create or replace function public.enforce_single_default_variant()
returns trigger language plpgsql as $$
begin
  if NEW.is_default = true then
    update public.meal_variants
       set is_default = false
     where meal_id = NEW.meal_id
       and id <> NEW.id;
  end if;
  return NEW;
end;
$$;

create or replace function public.place_order_atomic(
  p_customer_id        uuid,
  p_payment_method     text,
  p_notes              text,
  p_items              jsonb,        -- [{meal_id, quantity, customer_notes, today_special_id?, variant_id?, extras?: [{id, name, price}]}]
  p_estimated_delivery timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id      uuid;
  v_order_number  text;
  v_subtotal      numeric(10,2) := 0;
  v_delivery_fee  numeric(10,2) := 25;
  v_total         numeric(10,2);
  v_item          jsonb;
  v_meal_id       uuid;
  v_special_id    uuid;
  v_variant_id    uuid;
  v_extras        jsonb;
  v_qty           integer;
  v_notes         text;
  v_unit_price    numeric(10,2);
  v_meal_name     text;
  v_meal_image    text;
  v_variant_name  text;
  v_extras_cost   numeric(10,2) := 0;
  v_extra_item    jsonb;
  v_special_row   record;
  v_meal_row      record;
  v_variant_row   record;
  v_order_items   jsonb[] := '{}';
begin
  -- Check restaurant availability
  if not public.is_restaurant_open() then
    raise exception 'عذراً، المطعم مغلق حالياً ولا يستقبل طلبات جديدة.';
  end if;

  -- Fetch delivery fee
  select (value::text)::numeric into v_delivery_fee
    from public.app_settings
   where key = 'delivery_fee';
  if v_delivery_fee is null then v_delivery_fee := 25; end if;

  -- Generate order number
  v_order_number := 'ORD-' || to_char(nextval('public.order_number_seq'), 'FM00000000');

  -- Process items
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_meal_id    := (v_item->>'meal_id')::uuid;
    v_special_id := (v_item->>'today_special_id')::uuid;
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_extras     := v_item->'extras';
    v_qty        := (v_item->>'quantity')::integer;
    v_notes      := v_item->>'customer_notes';

    if v_qty is null or v_qty <= 0 then
      raise exception 'كمية غير صالحة للصنف %', v_meal_id;
    end if;

    v_extras_cost := 0;
    if v_extras is not null and jsonb_array_length(v_extras) > 0 then
      for v_extra_item in select * from jsonb_array_elements(v_extras) loop
        v_extras_cost := v_extras_cost + ((v_extra_item->>'price')::numeric);
      end loop;
    end if;

    -- Case A: Today Special item
    if v_special_id is not null then
      update public.available_today
         set quantity = quantity - v_qty,
             updated_at = now()
       where id = v_special_id
          and is_active = true
          and public.is_special_available(id)
          and quantity >= v_qty
        returning * into v_special_row;

      if not found then
        raise exception 'العرض اليومي غير متاح أو أن الكمية المطلوبة غير متوفرة';
      end if;

      v_unit_price   := v_special_row.price + v_extras_cost;
      v_meal_name    := v_special_row.title;
      v_meal_image   := v_special_row.image_url;
      v_variant_name := null;

    -- Case B: Regular meal or variant
    else
      if v_variant_id is not null then
        select mv.name, coalesce(mv.image_url, m.image_url) as image_url, mv.price, mv.is_available, mv.track_stock, mv.stock_count, m.name as base_name, mv.is_deleted
          into v_variant_row
          from public.meal_variants mv
          join public.meals m on m.id = mv.meal_id
         where mv.id = v_variant_id;

        if not found or v_variant_row.is_deleted then
          raise exception 'الخيار المحدد غير موجود';
        end if;

        if not v_variant_row.is_available or (v_variant_row.track_stock and v_variant_row.stock_count is not null and v_variant_row.stock_count < v_qty) then
          raise exception 'الخيار % غير متاح حالياً أو نفذت الكمية', v_variant_row.name;
        end if;

        -- Decrement stock if stock tracking enabled
        if v_variant_row.track_stock and v_variant_row.stock_count is not null then
          update public.meal_variants
             set stock_count = stock_count - v_qty,
                 updated_at = now()
           where id = v_variant_id;
        end if;

        v_unit_price   := v_variant_row.price + v_extras_cost;
        v_meal_name    := v_variant_row.base_name || ' - ' || v_variant_row.name;
        v_meal_image   := v_variant_row.image_url;
        v_variant_name := v_variant_row.name;
      else
        select name, image_url, price, is_available, is_deleted into v_meal_row
          from public.meals
         where id = v_meal_id;

        if not found or v_meal_row.is_deleted then
          raise exception 'الصنف غير موجود';
        end if;

        if not v_meal_row.is_available then
          raise exception 'الصنف % غير متاح حالياً', v_meal_row.name;
        end if;

        v_unit_price   := v_meal_row.price + v_extras_cost;
        v_meal_name    := v_meal_row.name;
        v_meal_image   := v_meal_row.image_url;
        v_variant_name := null;
      end if;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    v_order_items := array_append(v_order_items, jsonb_build_object(
      'meal_id',          v_meal_id,
      'today_special_id', v_special_id,
      'variant_id',       v_variant_id,
      'variant_name',     v_variant_name,
      'selected_extras',  v_extras,
      'quantity',         v_qty,
      'unit_price',       v_unit_price,
      'total_price',      v_unit_price * v_qty,
      'customer_notes',   v_notes,
      'meal_name',        v_meal_name,
      'meal_image',       v_meal_image
    ));
  end loop;

  v_total := v_subtotal + v_delivery_fee;

  -- Create order
  insert into public.orders (
    customer_id, order_number, subtotal, delivery_fee,
    discount, tax, total, status, payment_method,
    payment_status, notes, estimated_delivery
  ) values (
    p_customer_id, v_order_number, v_subtotal, v_delivery_fee,
    0, 0, v_total, 'pending_admin', p_payment_method,
    'pending', p_notes, p_estimated_delivery
  )
  returning id into v_order_id;

  -- Create order items
  insert into public.order_items (
    order_id, meal_id, today_special_id, variant_id, variant_name, selected_extras, quantity, unit_price, total_price, customer_notes, meal_name, meal_image
  )
  select v_order_id,
         (oi->>'meal_id')::uuid,
         (oi->>'today_special_id')::uuid,
         (oi->>'variant_id')::uuid,
         oi->>'variant_name',
         oi->'selected_extras',
         (oi->>'quantity')::integer,
         (oi->>'unit_price')::numeric,
         (oi->>'total_price')::numeric,
         oi->>'customer_notes',
         oi->>'meal_name',
         oi->>'meal_image'
    from unnest(v_order_items) as oi;

  -- Timeline
  insert into public.order_timeline (order_id, status, created_by, notes)
  values (v_order_id, 'pending_admin', coalesce(p_customer_id::text, 'system'), 'تم إنشاء الطلب');

  -- Notifications
  if p_customer_id is not null then
    insert into public.notifications (user_id, title, body, type, is_read)
    values (
      p_customer_id,
      'تم استلام طلبك ✓',
      'طلبك #' || v_order_number || ' قيد المراجعة. سنتواصل معك قريباً.',
      'order_received',
      false
    );
  end if;

  insert into public.notifications (user_id, title, body, type, is_read)
  select id, 'طلب جديد ! 📦', 'تم إنشاء الطلب رقم #' || v_order_number || ' وبانتظار المراجعة.', 'order_received', false
    from public.profiles
   where role = 'admin';

  return jsonb_build_object(
    'orderId',      v_order_id,
    'orderNumber',  v_order_number,
    'total',        v_total,
    'subtotal',     v_subtotal,
    'deliveryFee',  v_delivery_fee
  );
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. TRIGGERS
-- ────────────────────────────────────────────────────────────

drop trigger if exists trg_single_default_variant on public.meal_variants;
create trigger trg_single_default_variant
  before insert or update of is_default on public.meal_variants
  for each row
  when (NEW.is_default = true)
  execute function public.enforce_single_default_variant();
