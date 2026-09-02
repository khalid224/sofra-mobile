-- ============================================================
-- SOFRA — RLS planner cleanup and duplicate-policy removal
-- ============================================================

begin;

-- Public availability helpers read tables that already expose the relevant
-- rows through RLS, so they do not need SECURITY DEFINER privileges.
alter function public.is_restaurant_open() security invoker;
alter function public.is_special_available(uuid) security invoker;

-- Restrict customer/admin policies that were accidentally created for the
-- implicit PUBLIC role. Service role continues to bypass RLS.
alter policy "ars_admin_own" on public.admin_read_state to authenticated;
alter policy "analytics_select_admin" on public.analytics_events to authenticated;
alter policy "app_settings admin write" on public.app_settings to authenticated;
alter policy "audit_logs_admin" on public.audit_logs to authenticated;
alter policy "available_today_admin_write" on public.available_today to authenticated;
alter policy "brand_settings admin write" on public.brand_settings to authenticated;
alter policy "categories_admin_write" on public.categories to authenticated;
alter policy "complaints_admin_update" on public.complaints to authenticated;
alter policy "complaints_own" on public.complaints to authenticated;
alter policy "cook_availability_admin" on public.cook_availability to authenticated;
alter policy "cooks_admin_all" on public.cooks to authenticated;
alter policy "coupons_admin_write" on public.coupons to authenticated;
alter policy "addresses_own" on public.customer_addresses to authenticated;
alter policy "customer_notes_admin" on public.customer_notes to authenticated;
alter policy "device_tokens_all_policy" on public.device_tokens to authenticated;
alter policy "dispatch_admin" on public.dispatch_history to authenticated;
alter policy "favorites_own" on public.favorites to authenticated;
alter policy "price_history_admin" on public.meal_price_history to authenticated;
alter policy "meal_variant_extras_write" on public.meal_variant_extras to authenticated;
alter policy "meal_variants_write" on public.meal_variants to authenticated;
alter policy "meals_admin_write" on public.meals to authenticated;
alter policy "order_items_insert_admin" on public.order_items to authenticated;
alter policy "order_items_select" on public.order_items to authenticated;
alter policy "ratings_select" on public.order_ratings to authenticated;
alter policy "order_timeline_insert_admin" on public.order_timeline to authenticated;
alter policy "order_timeline_select" on public.order_timeline to authenticated;
alter policy "orders_insert_admin" on public.orders to authenticated;
alter policy "orders_select" on public.orders to authenticated;
alter policy "orders_update_admin" on public.orders to authenticated;
alter policy "profiles_select_own" on public.profiles to authenticated;
alter policy "reviews_admin_delete" on public.reviews to authenticated;
alter policy "reviews_admin_update" on public.reviews to authenticated;
alter policy "reviews_select" on public.reviews to authenticated;
alter policy "subcategories_admin_write" on public.subcategories to authenticated;

-- Remove policies duplicated by later migrations.
drop policy if exists "settings_admin_write" on public.app_settings;
drop policy if exists "settings_select_all" on public.app_settings;
drop policy if exists "device_tokens_own" on public.device_tokens;
drop index if exists public.idx_device_tokens_user;

-- Avoid SELECT overlap from FOR ALL policies.
drop policy if exists "np_write_own" on public.notification_preferences;
create policy "np_insert_own" on public.notification_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "np_update_own" on public.notification_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "np_delete_own" on public.notification_preferences
  for delete to authenticated
  using ((select auth.uid()) = user_id);
alter policy "np_select_own" on public.notification_preferences to authenticated;

drop policy if exists "notifications_admin_all" on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_read_own" on public.notifications;
create policy "notifications_select_self_or_admin" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
create policy "notifications_update_self_or_admin" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin())
  with check ((select auth.uid()) = user_id or public.is_admin());
create policy "notifications_insert_admin" on public.notifications
  for insert to authenticated with check (public.is_admin());
create policy "notifications_delete_admin" on public.notifications
  for delete to authenticated using (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

drop policy if exists "reviews_insert_admin" on public.reviews;
drop policy if exists "reviews_insert_customer_verified" on public.reviews;
create policy "reviews_insert_admin_or_verified_customer" on public.reviews
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      (select auth.uid()) = customer_id
      and status = 'pending'
      and deleted_at is null
      and is_pinned = false
      and coalesce(pin_order, 0) = 0
      and exists (
        select 1
        from public.orders o
        join public.order_items oi on oi.order_id = o.id
        where o.id = reviews.order_id
          and o.customer_id = (select auth.uid())
          and o.status = 'delivered'
          and oi.meal_id = reviews.meal_id
      )
    )
  );

-- Replace per-row auth calls with initplans only for the policies identified
-- by the advisor. Existing semantics and roles are preserved.
do $$
declare
  r record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (
        ('profiles', 'profiles_select_own'),
        ('customer_addresses', 'addresses_own'),
        ('order_items', 'order_items_select'),
        ('order_timeline', 'order_timeline_select'),
        ('complaints', 'complaints_own'),
        ('device_tokens', 'device_tokens_all_policy'),
        ('favorites', 'favorites_own'),
        ('orders', 'orders_select'),
        ('notification_preferences', 'np_select_own'),
        ('order_ratings', 'ratings_select'),
        ('admin_read_state', 'ars_admin_own'),
        ('brand_settings', 'brand_settings admin write'),
        ('app_settings', 'app_settings admin write'),
        ('meal_variants', 'meal_variants_write'),
        ('meal_variant_extras', 'meal_variant_extras_write'),
        ('reviews', 'reviews_select')
      )
  loop
    v_qual := replace(replace(r.qual, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())');
    v_check := replace(replace(r.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())');
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end;
$$;

commit;
