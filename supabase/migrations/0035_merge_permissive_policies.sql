-- ============================================================
-- SOFRA — Merge overlapping permissive RLS policies
-- ============================================================

begin;

-- Admin FOR ALL policies overlap public/customer SELECT policies. Split them
-- into write-only policies; service_role bypasses RLS and needs no policy.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('app_settings', 'app_settings admin write'),
      ('available_today', 'available_today_admin_write'),
      ('brand_settings', 'brand_settings admin write'),
      ('categories', 'categories_admin_write'),
      ('coupons', 'coupons_admin_write'),
      ('meal_variant_extras', 'meal_variant_extras_write'),
      ('meal_variants', 'meal_variants_write'),
      ('meals', 'meals_admin_write'),
      ('subcategories', 'subcategories_admin_write')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', r.policy_name, r.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
      r.table_name || '_admin_insert', r.table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      r.table_name || '_admin_update', r.table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      r.table_name || '_admin_delete', r.table_name
    );
  end loop;
end;
$$;

drop policy if exists "chat_messages_insert_admin" on public.chat_messages;
drop policy if exists "chat_messages_insert_customer" on public.chat_messages;
create policy "chat_messages_insert_authorized" on public.chat_messages
  for insert to authenticated
  with check (
    (public.is_admin() and sender_type = 'admin')
    or (
      sender_type = 'customer'
      and exists (
        select 1 from public.chat_threads t
        where t.id = chat_messages.thread_id
          and t.customer_id = (select auth.uid())
      )
    )
  );

drop policy if exists "chat_messages_update_admin" on public.chat_messages;
drop policy if exists "chat_messages_update_customer_read" on public.chat_messages;
create policy "chat_messages_update_authorized" on public.chat_messages
  for update to authenticated
  using (
    public.is_admin()
    or (
      sender_type = 'admin'
      and exists (
        select 1 from public.chat_threads t
        where t.id = chat_messages.thread_id
          and t.customer_id = (select auth.uid())
      )
    )
  )
  with check (
    public.is_admin()
    or (
      sender_type = 'admin'
      and exists (
        select 1 from public.chat_threads t
        where t.id = chat_messages.thread_id
          and t.customer_id = (select auth.uid())
      )
    )
  );

drop policy if exists "chat_threads_admin_all" on public.chat_threads;
drop policy if exists "chat_threads_insert_customer" on public.chat_threads;
create policy "chat_threads_insert_authorized" on public.chat_threads
  for insert to authenticated
  with check (
    public.is_admin()
    or ((select auth.uid()) = customer_id and unread_count = 0)
  );
create policy "chat_threads_update_admin" on public.chat_threads
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "chat_threads_delete_admin" on public.chat_threads
  for delete to authenticated using (public.is_admin());

commit;
