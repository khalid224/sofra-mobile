-- ============================================================
-- SOFRA ENTERPRISE — Migration 004
-- Per 22_BUSINESS_RULES.md:
--   - Favorites table
--   - Price history (meal prices versioned)
--   - Soft delete fields (never physically delete orders/reviews/complaints)
--   - pg_cron for daily report
-- ============================================================

-- ─── FAVORITES ───────────────────────────────────────────────
create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  meal_id     uuid not null references public.meals(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(customer_id, meal_id)
);
create index if not exists favorites_customer_idx on public.favorites(customer_id);

alter table public.favorites enable row level security;
drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
  for all using (auth.uid() = customer_id or public.is_admin());
grant all on public.favorites to authenticated;

-- ─── PRICE HISTORY (per 22: "Meal prices are versioned") ─────
create table if not exists public.meal_price_history (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals(id) on delete cascade,
  old_price  numeric(10, 2) not null,
  new_price  numeric(10, 2) not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists price_history_meal_idx on public.meal_price_history(meal_id);

alter table public.meal_price_history enable row level security;
drop policy if exists "price_history_admin" on public.meal_price_history;
create policy "price_history_admin" on public.meal_price_history
  for all using (public.is_admin());

-- Trigger: auto-record price change when meal.price is updated
create or replace function public.record_price_change()
returns trigger language plpgsql security definer as $$
begin
  if new.price is distinct from old.price then
    insert into public.meal_price_history(meal_id, old_price, new_price)
    values (new.id, old.price, new.price);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_price_history on public.meals;
create trigger trg_price_history
  after update of price on public.meals
  for each row execute function public.record_price_change();

-- ─── SOFT DELETE (per 22: "Never physically delete Orders/Reviews/Complaints") ──
alter table public.orders     add column if not exists deleted_at timestamptz;
alter table public.reviews    add column if not exists deleted_at timestamptz;
alter table public.complaints add column if not exists deleted_at timestamptz;
alter table public.meals      add column if not exists deleted_at timestamptz;

-- Update existing RLS to exclude soft-deleted records from customer view
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select using (
    deleted_at is null and
    (auth.uid() = customer_id or public.is_admin())
  );

drop policy if exists "meals_select_available" on public.meals;
create policy "meals_select_available" on public.meals
  for select using (
    deleted_at is null and
    (is_available = true or public.is_admin())
  );

-- ─── CART EXPIRY via app_settings ────────────────────────────
-- Per 22: "Cart expires after configurable inactivity"
insert into public.app_settings(key, value, description) values
  ('cart_expiry_hours', '24', 'مدة انتهاء صلاحية سلة التسوق (ساعات)')
on conflict(key) do nothing;

-- ─── MAX QUANTITY setting ─────────────────────────────────────
insert into public.app_settings(key, value, description) values
  ('max_cart_quantity_per_item', '20', 'الحد الأقصى للكمية لكل صنف في السلة')
on conflict(key) do nothing;

-- ─── pg_cron for daily report at 09:00 ───────────────────────
-- Requires pg_cron extension (enabled in Supabase Pro / Team plans)
-- Run manually or via Supabase CLI if on free plan:
--   select cron.schedule('daily-report', '0 9 * * *', $$
--     select net.http_post(
--       url := current_setting('app.settings.push_function_url', true) || '/../daily-report',
--       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
--       body := '{}'::jsonb
--     );
--   $$);
--
-- NOTE: uncomment the above if pg_cron is available in your Supabase plan.
