-- ============================================================
-- SOFRA — Security hotfix
--
-- Closes privilege-escalation paths in profiles, prevents chat
-- sender impersonation, restricts notification writes, validates
-- reviews against delivered orders, and locks down privileged RPCs.
-- This migration is intentionally additive/compatible with the
-- current mobile app and web admin architecture.
-- ============================================================

-- ── 1. Admin checks must exclude blocked/deleted accounts ─────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- A customer must never be able to change their role/status, even
-- if a future permissive policy is accidentally added.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Keep trusted database/Auth maintenance flows working. PostgREST
  -- customer requests execute as authenticated, not one of these roles.
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
     or (select auth.role()) = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if (select auth.uid()) is null
     or (select auth.uid()) <> old.id
     or new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.status is distinct from old.status then
    raise exception 'PROFILE_SECURITY_FIELDS_FORBIDDEN'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_security_fields on public.profiles;
create trigger trg_protect_profile_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

drop policy if exists "profiles_insert_trigger" on public.profiles;
drop policy if exists "profiles_insert_customer" on public.profiles;
create policy "profiles_insert_customer"
  on public.profiles for insert to authenticated
  with check (
    (
      (select auth.uid()) = id
      and role = 'customer'
      and status = 'active'
    )
    or public.is_admin()
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 2. Chat: operation-specific RLS and server-owned metadata ──
drop policy if exists "chat_messages_access" on public.chat_messages;
drop policy if exists "chat_messages_select" on public.chat_messages;
drop policy if exists "chat_messages_insert_customer" on public.chat_messages;
drop policy if exists "chat_messages_insert_admin" on public.chat_messages;
drop policy if exists "chat_messages_update_customer_read" on public.chat_messages;
drop policy if exists "chat_messages_update_admin" on public.chat_messages;
drop policy if exists "chat_messages_delete_admin" on public.chat_messages;

create policy "chat_messages_select"
  on public.chat_messages for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.customer_id = (select auth.uid())
    )
  );

create policy "chat_messages_insert_customer"
  on public.chat_messages for insert to authenticated
  with check (
    sender_type = 'customer'
    and exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.customer_id = (select auth.uid())
    )
  );

create policy "chat_messages_insert_admin"
  on public.chat_messages for insert to authenticated
  with check (public.is_admin() and sender_type = 'admin');

-- Customers can acknowledge admin messages, but column grants below
-- ensure they can update only is_read, never message/sender/thread.
create policy "chat_messages_update_customer_read"
  on public.chat_messages for update to authenticated
  using (
    sender_type = 'admin'
    and exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.customer_id = (select auth.uid())
    )
  )
  with check (
    sender_type = 'admin'
    and exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.customer_id = (select auth.uid())
    )
  );

create policy "chat_messages_update_admin"
  on public.chat_messages for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "chat_messages_delete_admin"
  on public.chat_messages for delete to authenticated
  using (public.is_admin());

revoke all on public.chat_messages from anon;
revoke update on public.chat_messages from authenticated;
grant select, insert, delete on public.chat_messages to authenticated;
grant update (is_read) on public.chat_messages to authenticated;

drop policy if exists "chat_threads_own" on public.chat_threads;
drop policy if exists "chat_threads_select" on public.chat_threads;
drop policy if exists "chat_threads_insert_customer" on public.chat_threads;
drop policy if exists "chat_threads_admin_all" on public.chat_threads;

create policy "chat_threads_select"
  on public.chat_threads for select to authenticated
  using ((select auth.uid()) = customer_id or public.is_admin());

create policy "chat_threads_insert_customer"
  on public.chat_threads for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and unread_count = 0
  );

create policy "chat_threads_admin_all"
  on public.chat_threads for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.chat_threads from anon;
grant select, insert, update, delete on public.chat_threads to authenticated;

-- last_message_at and the admin-facing unread counter are derived by
-- the database, so the customer no longer needs UPDATE on chat_threads.
create or replace function public.maintain_chat_thread_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.chat_threads
  set last_message_at = new.created_at,
      unread_count = case
        when new.sender_type = 'customer' then unread_count + 1
        else unread_count
      end,
      updated_at = now()
  where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists trg_maintain_chat_thread_from_message on public.chat_messages;
create trigger trg_maintain_chat_thread_from_message
  after insert on public.chat_messages
  for each row execute function public.maintain_chat_thread_from_message();

-- ── 3. Notifications: users read/acknowledge, server creates ───
drop policy if exists "notifications_own" on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_read_own" on public.notifications;
drop policy if exists "notifications_admin_all" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "notifications_update_read_own"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notifications_admin_all"
  on public.notifications for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.notifications from anon;
revoke update on public.notifications from authenticated;
grant select, insert, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ── 4. Reviews/ratings must belong to a delivered order ───────
drop policy if exists "ratings_insert_own" on public.order_ratings;
create policy "ratings_insert_own"
  on public.order_ratings for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and exists (
      select 1
      from public.orders o
      where o.id = order_ratings.order_id
        and o.customer_id = (select auth.uid())
        and o.status = 'delivered'
        and order_ratings.cook_id is not distinct from o.cook_id
    )
  );

drop policy if exists "reviews_insert_own" on public.reviews;
drop policy if exists "reviews_insert_customer_verified" on public.reviews;
drop policy if exists "reviews_insert_admin" on public.reviews;

create policy "reviews_insert_customer_verified"
  on public.reviews for insert to authenticated
  with check (
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
  );

create policy "reviews_insert_admin"
  on public.reviews for insert to authenticated
  with check (public.is_admin());

-- Keep cook aggregates correct after edits/deletions as well as inserts.
create or replace function public.update_cook_rating_on_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_cook_id uuid := case when tg_op in ('UPDATE', 'DELETE') then old.cook_id end;
  v_new_cook_id uuid := case when tg_op in ('INSERT', 'UPDATE') then new.cook_id end;
begin
  if v_old_cook_id is not null then
    update public.cooks
    set rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from public.order_ratings
      where cook_id = v_old_cook_id
    ), 0)
    where id = v_old_cook_id;
  end if;

  if v_new_cook_id is not null and v_new_cook_id is distinct from v_old_cook_id then
    update public.cooks
    set rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from public.order_ratings
      where cook_id = v_new_cook_id
    ), 0)
    where id = v_new_cook_id;
  elsif tg_op = 'INSERT' and v_new_cook_id is not null then
    update public.cooks
    set rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from public.order_ratings
      where cook_id = v_new_cook_id
    ), 0)
    where id = v_new_cook_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_update_cook_rating on public.order_ratings;
create trigger trg_update_cook_rating
  after insert or update or delete on public.order_ratings
  for each row execute function public.update_cook_rating_on_review();

-- ── 5. Privileged maintenance functions are service-only ─────
alter function public.refresh_analytics_views() set search_path = public, pg_temp;
revoke all on function public.refresh_analytics_views() from public, anon, authenticated;
grant execute on function public.refresh_analytics_views() to service_role;

-- Harden mutable search paths on legacy/trigger functions that remain
-- in the schema. Trigger functions are still invoked normally by DB.
alter function public.handle_available_today_status() set search_path = public, pg_temp;
alter function public.is_restaurant_open() set search_path = public, pg_temp;
alter function public.is_special_available(uuid) set search_path = public, pg_temp;
alter function public.record_price_change() set search_path = public, pg_temp;
alter function public.notify_admin_chat_reply() set search_path = public, vault, extensions, pg_temp;
alter function public.notify_admins_new_order() set search_path = public, vault, extensions, pg_temp;
alter function public.notify_customers_new_special() set search_path = public, vault, extensions, pg_temp;
alter function public.notify_new_today_special() set search_path = public, pg_temp;
alter function public.notify_order_status_change() set search_path = public, vault, extensions, pg_temp;

-- Only the service role should invoke legacy privileged functions directly.
revoke all on function public.notify_admin_chat_reply() from public, anon, authenticated;
revoke all on function public.notify_admins_new_order() from public, anon, authenticated;
revoke all on function public.notify_customers_new_special() from public, anon, authenticated;
revoke all on function public.notify_new_today_special() from public, anon, authenticated;
revoke all on function public.notify_order_status_change() from public, anon, authenticated;
