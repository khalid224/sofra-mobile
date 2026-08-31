-- Keep the admin dashboard and customer app synchronized without polling.
-- Idempotently adds the application's shared tables to Supabase Realtime.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'orders', 'order_items', 'order_timeline',
    'categories', 'subcategories', 'meals', 'meal_variants', 'meal_variant_extras',
    'available_today', 'reviews', 'complaints',
    'chat_threads', 'chat_messages', 'profiles', 'cooks',
    'app_settings', 'brand_settings', 'notifications', 'admin_read_state'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
       ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;
