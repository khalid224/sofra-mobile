-- ============================================================
-- SOFRA ENTERPRISE — Reliable, deduplicated push pipeline
--
-- Canonical flow:
-- domain event -> notifications row -> one pg_net dispatcher -> Edge Function
--
-- The legacy direct push triggers intentionally remain disabled because they
-- overlap with the notification-row triggers and send duplicate pushes.
-- ============================================================

create extension if not exists "pg_net" with schema extensions;

-- Hosted Supabase does not permit ALTER DATABASE ... SET app.settings.*.
-- Read the service-role key from Vault and keep the non-secret function URL
-- in the function body.
create or replace function public.dispatch_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_function_url constant text :=
    'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_service_key text := (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1
  );
begin
  if v_service_key is null or v_service_key = '' then
    raise warning 'Push dispatch skipped: Vault secret service_role_key is missing';
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

  return new;
end;
$$;

drop trigger if exists trg_dispatch_push_on_notification on public.notifications;
create trigger trg_dispatch_push_on_notification
  after insert on public.notifications
  for each row execute function public.dispatch_push_on_notification_insert();

-- Guarantee that every newly-created order produces one in-app/push
-- notification per active admin. The trigger is deferred until transaction
-- end so the ordering RPC can create its richer admin notification first;
-- NOT EXISTS then prevents duplicates.
create or replace function public.enqueue_admins_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, type, is_read, data)
  select
    p.id,
    case when coalesce(new.is_scheduled, false)
      then 'طلب مجدول جديد 📅'
      else 'طلب جديد 📦'
    end,
    'تم إنشاء الطلب #' || new.order_number || ' بقيمة ' || new.total || ' جنيه.',
    'order_received',
    false,
    jsonb_build_object('order_id', new.id, 'type', 'new_order')
  from public.profiles p
  where p.role = 'admin'
    and p.status = 'active'
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = p.id
        and n.type in ('order_received', 'new_order')
        and n.data ->> 'order_id' = new.id::text
    );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_admins_new_order on public.orders;
create constraint trigger trg_enqueue_admins_new_order
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.enqueue_admins_new_order();

-- Keep one delivery path. These historical direct pg_net triggers overlap
-- with the canonical notifications dispatcher above.
drop trigger if exists trg_order_status_push on public.orders;
drop trigger if exists trg_new_order_admin_push on public.orders;
drop trigger if exists trg_admin_chat_reply_push on public.chat_messages;
drop trigger if exists trg_new_special_notification on public.available_today;
drop trigger if exists trg_new_special_push on public.available_today;

-- Repair service-role access for existing and future public objects.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
