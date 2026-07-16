-- ============================================================
-- SOFRA ENTERPRISE — Row Level Security Policies
-- Rule 8: Service role keys never reach frontend
-- Rule 19: Security — customers access only their own data
-- ============================================================

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- PROFILES
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "profiles_insert_trigger" on public.profiles;
create policy "profiles_insert_trigger" on public.profiles
  for insert with check (auth.uid() = id);

-- ============================================================
-- CUSTOMER ADDRESSES
-- ============================================================
alter table public.customer_addresses enable row level security;

drop policy if exists "addresses_own" on public.customer_addresses;
create policy "addresses_own" on public.customer_addresses
  for all using (auth.uid() = customer_id or public.is_admin());

-- ============================================================
-- CATEGORIES (public read, admin write)
-- ============================================================
alter table public.categories enable row level security;

drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all" on public.categories
  for select using (is_active = true or public.is_admin());

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin());

-- ============================================================
-- SUBCATEGORIES (public read, admin write)
-- ============================================================
alter table public.subcategories enable row level security;

drop policy if exists "subcategories_select_all" on public.subcategories;
create policy "subcategories_select_all" on public.subcategories
  for select using (is_active = true or public.is_admin());

drop policy if exists "subcategories_admin_write" on public.subcategories;
create policy "subcategories_admin_write" on public.subcategories
  for all using (public.is_admin());

-- ============================================================
-- MEALS (public read available, admin write)
-- ============================================================
alter table public.meals enable row level security;

drop policy if exists "meals_select_available" on public.meals;
create policy "meals_select_available" on public.meals
  for select using (is_available = true or public.is_admin());

drop policy if exists "meals_admin_write" on public.meals;
create policy "meals_admin_write" on public.meals
  for all using (public.is_admin());

-- ============================================================
-- COOKS (admin only — cooks never login)
-- ============================================================
alter table public.cooks enable row level security;

drop policy if exists "cooks_admin_all" on public.cooks;
create policy "cooks_admin_all" on public.cooks
  for all using (public.is_admin());

-- ============================================================
-- COOK AVAILABILITY (admin only)
-- ============================================================
alter table public.cook_availability enable row level security;

drop policy if exists "cook_availability_admin" on public.cook_availability;
create policy "cook_availability_admin" on public.cook_availability
  for all using (public.is_admin());

-- ============================================================
-- ORDERS (customer sees own, admin sees all)
-- ============================================================
alter table public.orders enable row level security;

drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "orders_insert_service" on public.orders;
create policy "orders_insert_service" on public.orders
  for insert with check (true); -- handled by edge function (service role)

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin" on public.orders
  for update using (public.is_admin());

-- ============================================================
-- ORDER ITEMS (same as orders)
-- ============================================================
alter table public.order_items enable row level security;

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items
  for select using (
    exists (select 1 from public.orders where id = order_id and (customer_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items
  for insert with check (true); -- service role via edge function

-- ============================================================
-- ORDER TIMELINE (customer sees own, admin all)
-- ============================================================
alter table public.order_timeline enable row level security;

drop policy if exists "order_timeline_select" on public.order_timeline;
create policy "order_timeline_select" on public.order_timeline
  for select using (
    exists (select 1 from public.orders where id = order_id and (customer_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "order_timeline_insert" on public.order_timeline;
create policy "order_timeline_insert" on public.order_timeline
  for insert with check (true);

-- ============================================================
-- DISPATCH HISTORY (admin only)
-- ============================================================
alter table public.dispatch_history enable row level security;

drop policy if exists "dispatch_admin" on public.dispatch_history;
create policy "dispatch_admin" on public.dispatch_history
  for all using (public.is_admin());

-- ============================================================
-- REVIEWS (public read approved, customer write own)
-- ============================================================
alter table public.reviews enable row level security;

drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews
  for select using (status = 'approved' or auth.uid() = customer_id or public.is_admin());

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = customer_id);

drop policy if exists "reviews_admin_update" on public.reviews;
create policy "reviews_admin_update" on public.reviews
  for update using (public.is_admin());

-- ============================================================
-- COMPLAINTS (customer sees own, admin all)
-- ============================================================
alter table public.complaints enable row level security;

drop policy if exists "complaints_own" on public.complaints;
create policy "complaints_own" on public.complaints
  for select using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "complaints_insert_own" on public.complaints;
create policy "complaints_insert_own" on public.complaints
  for insert with check (auth.uid() = customer_id);

drop policy if exists "complaints_admin_update" on public.complaints;
create policy "complaints_admin_update" on public.complaints
  for update using (public.is_admin());

-- ============================================================
-- CHAT THREADS (customer sees own, admin all)
-- ============================================================
alter table public.chat_threads enable row level security;

drop policy if exists "chat_threads_own" on public.chat_threads;
create policy "chat_threads_own" on public.chat_threads
  for all using (auth.uid() = customer_id or public.is_admin());

-- ============================================================
-- CHAT MESSAGES (via thread ownership)
-- ============================================================
alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_access" on public.chat_messages;
create policy "chat_messages_access" on public.chat_messages
  for all using (
    exists (
      select 1 from public.chat_threads
      where id = thread_id and (customer_id = auth.uid() or public.is_admin())
    )
  );

-- ============================================================
-- NOTIFICATIONS (user sees own)
-- ============================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for all using (auth.uid() = user_id or public.is_admin());

-- ============================================================
-- DEVICE TOKENS (user manages own)
-- ============================================================
alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_own" on public.device_tokens;
create policy "device_tokens_own" on public.device_tokens
  for all using (auth.uid() = user_id or public.is_admin());

-- ============================================================
-- APP SETTINGS (public read, admin write)
-- ============================================================
alter table public.app_settings enable row level security;

drop policy if exists "settings_select_all" on public.app_settings;
create policy "settings_select_all" on public.app_settings
  for select using (true);

drop policy if exists "settings_admin_write" on public.app_settings;
create policy "settings_admin_write" on public.app_settings
  for all using (public.is_admin());

-- ============================================================
-- CUSTOMER NOTES (admin only)
-- ============================================================
alter table public.customer_notes enable row level security;

drop policy if exists "customer_notes_admin" on public.customer_notes;
create policy "customer_notes_admin" on public.customer_notes
  for all using (public.is_admin());

-- ============================================================
-- AUDIT LOGS (admin read only)
-- ============================================================
alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_admin" on public.audit_logs;
create policy "audit_logs_admin" on public.audit_logs
  for all using (public.is_admin());

-- ============================================================
-- COUPONS (admin write, authenticated read active)
-- ============================================================
alter table public.coupons enable row level security;

drop policy if exists "coupons_select_active" on public.coupons;
create policy "coupons_select_active" on public.coupons
  for select using (is_active = true or public.is_admin());

drop policy if exists "coupons_admin_write" on public.coupons;
create policy "coupons_admin_write" on public.coupons
  for all using (public.is_admin());

-- ============================================================
-- GRANTS
-- ============================================================
grant usage on schema public to authenticated, anon;
grant select on public.categories, public.subcategories, public.meals, public.app_settings, public.coupons to anon;
grant all on all tables in schema public to authenticated;
grant execute on function public.is_admin() to authenticated;
