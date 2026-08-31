-- ============================================================
-- SOFRA ENTERPRISE — Notify customers when a new "available today"
-- dish / special is added. Uses pg_net to call send-push-notification
-- edge function (same pattern as 0003_push_triggers.sql).
-- ============================================================

create or replace function public.notify_customers_new_special()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := current_setting('app.settings.push_function_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
  v_customer_ids jsonb;
begin
  if v_function_url is null or v_function_url = '' then return new; end if;
  if new.is_active is not true then return new; end if;

  select jsonb_agg(id) into v_customer_ids
  from public.profiles
  where role = 'customer' and status = 'active';

  if v_customer_ids is not null and jsonb_array_length(v_customer_ids) > 0 then
    perform net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_service_key),
      body    := jsonb_build_object(
        'user_ids', v_customer_ids,
        'title', '🍽️ عرض جديد النهاردة!',
        'body',  coalesce(new.title, 'طبق جديد') || ' - جرّبه دلوقتي',
        'notification_type', 'promotion',
        'data', jsonb_build_object('screen', '/food/' || new.id, 'type', 'promotion')
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_new_special_push on public.available_today;
create trigger trg_new_special_push
  after insert on public.available_today
  for each row execute function public.notify_customers_new_special();
