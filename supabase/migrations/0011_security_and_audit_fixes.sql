-- ============================================================
-- 0011_security_and_audit_fixes.sql
-- Production Security & Policy Fixes
-- ============================================================

-- ── 1. Fix Orders Insert Policy ────────────────────────────────
-- Ensure customers can only create orders for themselves (or guest checkout where customer_id is null)
drop policy if exists "orders_insert_service" on public.orders;
drop policy if exists "orders_insert_user" on public.orders;
create policy "orders_insert_user" on public.orders
  for insert with check (
    auth.uid() = customer_id or customer_id is null or public.is_admin()
  );

-- ── 2. Fix Order Items Insert Policy ───────────────────────────
-- Ensure order items are attached to orders owned by the user or guest
drop policy if exists "order_items_insert" on public.order_items;
drop policy if exists "order_items_insert_user" on public.order_items;
create policy "order_items_insert_user" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders
      where id = order_id and (customer_id = auth.uid() or customer_id is null or public.is_admin())
    )
  );

-- ── 3. Fix Order Timeline Insert Policy ────────────────────────
drop policy if exists "order_timeline_insert" on public.order_timeline;
drop policy if exists "order_timeline_insert_user" on public.order_timeline;
create policy "order_timeline_insert_user" on public.order_timeline
  for insert with check (
    exists (
      select 1 from public.orders
      where id = order_id and (customer_id = auth.uid() or customer_id is null or public.is_admin())
    )
  );

-- ── 4. Add Indexes for Performance Optimization ───────────────
create index if not exists idx_orders_assigned_cook on public.orders(assigned_cook_id);
create index if not exists idx_orders_prep_status on public.orders(prep_status);
create index if not exists idx_available_today_status on public.available_today(status, is_active);
