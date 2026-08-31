-- ============================================================
-- SOFRA ENTERPRISE — Push delivery must never roll back orders
--
-- Notifications are a side effect. A temporary Vault, pg_net, DNS, or Edge
-- Function failure must not abort the transaction that created an order,
-- chat reply, status update, or today special.
-- ============================================================

create or replace function public.dispatch_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_function_url constant text :=
    'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_service_key text;
begin
  begin
    select decrypted_secret
      into v_service_key
      from vault.decrypted_secrets
     where name = 'service_role_key'
     limit 1;

    if v_service_key is null or v_service_key = '' then
      raise warning 'Push dispatch skipped for notification %: Vault secret service_role_key is missing', new.id;
      return new;
    end if;

    perform net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(new.user_id),
        'title', new.title,
        'body', new.body,
        'notification_type', new.type,
        'data', coalesce(new.data, '{}'::jsonb)
      )
    );
  exception when others then
    -- Do not let an optional push side effect roll back the business event.
    raise warning 'Push dispatch failed for notification % [%]: %', new.id, sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_dispatch_push_on_notification on public.notifications;
create trigger trg_dispatch_push_on_notification
  after insert on public.notifications
  for each row execute function public.dispatch_push_on_notification_insert();
