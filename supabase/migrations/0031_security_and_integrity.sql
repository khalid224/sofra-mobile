-- ============================================================
-- SOFRA — Security and integrity hardening
-- ============================================================

begin;

-- ── 1. Idempotent order creation and payload limits ──────────
alter table public.orders
  add column if not exists idempotency_key uuid,
  add column if not exists idempotency_payload_hash text;

create unique index if not exists orders_customer_idempotency_key_uidx
  on public.orders(customer_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.orders.idempotency_key is
  'Client-generated UUID. Unique per customer and order creation attempt.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_selected_extras_size_check'
  ) then
    alter table public.order_items
      add constraint order_items_selected_extras_size_check check (
        selected_extras is null
        or (
          jsonb_typeof(selected_extras) = 'array'
          and jsonb_array_length(selected_extras) <= 20
          and octet_length(selected_extras::text) <= 8192
        )
      ) not valid;
  end if;
end;
$$;

create or replace function public.place_order_atomic_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_idempotency_key uuid;
  v_payload_hash text;
  v_result jsonb;
  v_existing record;
  v_item jsonb;
  v_extras jsonb;
begin
  if v_customer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_customer_id and role in ('customer', 'admin') and status = 'active'
  ) then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 65536 then
    raise exception 'ORDER_PAYLOAD_TOO_LARGE_OR_INVALID' using errcode = '22023';
  end if;

  begin
    v_idempotency_key := nullif(p_payload->>'idempotency_key', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end;
  if v_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') not between 1 and 30 then
    raise exception 'INVALID_ORDER_ITEMS' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_extras := coalesce(v_item->'extras', '[]'::jsonb);
    if jsonb_typeof(v_item) <> 'object' or octet_length(v_item::text) > 12288 then
      raise exception 'ORDER_ITEM_TOO_LARGE' using errcode = '22023';
    end if;
    if jsonb_typeof(v_extras) <> 'array'
       or jsonb_array_length(v_extras) > 20
       or octet_length(v_extras::text) > 8192 then
      raise exception 'ORDER_EXTRAS_LIMIT_EXCEEDED' using errcode = '22023';
    end if;
  end loop;

  v_payload_hash := md5((p_payload - 'idempotency_key')::text);

  -- Serialise requests for the same customer/key before checking or creating.
  perform pg_advisory_xact_lock(
    hashtextextended(v_customer_id::text || ':' || v_idempotency_key::text, 0)
  );

  select id, order_number, subtotal, delivery_fee, total, is_scheduled,
         idempotency_payload_hash
    into v_existing
  from public.orders
  where customer_id = v_customer_id and idempotency_key = v_idempotency_key;

  if found then
    if v_existing.idempotency_payload_hash is distinct from v_payload_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'orderId', v_existing.id,
      'orderNumber', v_existing.order_number,
      'subtotal', v_existing.subtotal,
      'deliveryFee', v_existing.delivery_fee,
      'total', v_existing.total,
      'isScheduled', v_existing.is_scheduled,
      'idempotentReplay', true
    );
  end if;

  v_result := public.place_order_atomic_v2(p_payload - 'idempotency_key');

  update public.orders
  set idempotency_key = v_idempotency_key,
      idempotency_payload_hash = v_payload_hash
  where id = (v_result->>'orderId')::uuid and customer_id = v_customer_id;

  if not found then
    raise exception 'ORDER_IDEMPOTENCY_WRITE_FAILED';
  end if;

  return v_result || jsonb_build_object('idempotentReplay', false);
end;
$$;

revoke all on function public.place_order_atomic_v2(jsonb) from public, anon, authenticated;
revoke all on function public.place_order_atomic_v3(jsonb) from public, anon;
grant execute on function public.place_order_atomic_v3(jsonb) to authenticated;

-- Orders and their derived rows can only be written by the atomic RPC or
-- trusted server-side services. RLS alone is not sufficient while legacy
-- permissive insert policies still exist.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.order_timeline from anon, authenticated;
grant select on public.orders, public.order_items, public.order_timeline to authenticated;

-- ── 2. Block inactive customers from every write path ─────────
create or replace function public.enforce_active_account_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if (select auth.role()) = 'service_role' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.enforce_active_account_write() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'customer_addresses', 'favorites', 'notification_preferences',
    'orders', 'order_items', 'order_timeline', 'order_ratings', 'reviews',
    'complaints', 'chat_threads', 'chat_messages', 'notifications', 'device_tokens'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists trg_active_account_write on public.%I', v_table);
      execute format(
        'create trigger trg_active_account_write before insert or update or delete on public.%I for each row execute function public.enforce_active_account_write()',
        v_table
      );
    end if;
  end loop;
end;
$$;

drop trigger if exists trg_active_account_profile_write on public.profiles;
create trigger trg_active_account_profile_write
  before update or delete on public.profiles
  for each row execute function public.enforce_active_account_write();

-- ── 3. Daily reports belong in an admin-only table ────────────
create table if not exists public.daily_reports (
  report_date date primary key,
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_reports enable row level security;
drop policy if exists "daily_reports_admin_select" on public.daily_reports;
create policy "daily_reports_admin_select"
  on public.daily_reports for select to authenticated
  using (public.is_admin());

revoke all on public.daily_reports from public, anon, authenticated;
grant select on public.daily_reports to authenticated;
grant all on public.daily_reports to service_role;

insert into public.daily_reports(report_date, report, generated_at, updated_at)
select substring(key from 14)::date,
       case when jsonb_typeof(value) = 'string' then (value #>> '{}')::jsonb else value end,
       updated_at,
       updated_at
from public.app_settings
where key ~ '^report_daily_[0-9]{4}-[0-9]{2}-[0-9]{2}$'
on conflict (report_date) do update
set report = excluded.report,
    generated_at = excluded.generated_at,
    updated_at = excluded.updated_at;

delete from public.app_settings
where key ~ '^report_daily_[0-9]{4}-[0-9]{2}-[0-9]{2}$';

-- ── 4. Analytics: no raw table inserts from clients ──────────
drop policy if exists "analytics_insert" on public.analytics_events;
revoke all on public.analytics_events from public, anon, authenticated;
grant select on public.analytics_events to authenticated;

create or replace function public.log_analytics_event(
  p_event_name text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '42501';
  end if;

  if p_event_name is null or p_event_name !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'INVALID_ANALYTICS_EVENT' using errcode = '22023';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
     or octet_length(p_metadata::text) > 8192 then
    raise exception 'ANALYTICS_METADATA_TOO_LARGE_OR_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_metadata) key
    where lower(key) ~ '(token|password|secret|authorization|cookie)'
  ) then
    raise exception 'SENSITIVE_ANALYTICS_METADATA_KEY' using errcode = '22023';
  end if;
  if (
    select count(*) from public.analytics_events
    where user_id = v_uid and created_at >= now() - interval '1 hour'
  ) >= 120 then
    raise exception 'ANALYTICS_RATE_LIMIT_EXCEEDED' using errcode = '54000';
  end if;

  insert into public.analytics_events(user_id, event_name, metadata)
  values (v_uid, p_event_name, p_metadata);
end;
$$;

revoke all on function public.log_analytics_event(text, jsonb) from public, anon;
grant execute on function public.log_analytics_event(text, jsonb) to authenticated;

-- The notification dispatcher authenticates to the Edge Function with a
-- dedicated webhook secret, never the service-role JWT. Store the same
-- random value as Edge secret WEBHOOK_SECRET and Vault secret webhook_secret.
create or replace function public.dispatch_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_function_url constant text :=
    'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_webhook_secret text;
begin
  begin
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'webhook_secret'
    limit 1;

    if v_webhook_secret is null or length(v_webhook_secret) < 32 then
      raise warning 'Push dispatch skipped for notification %: Vault secret webhook_secret is missing', new.id;
      return new;
    end if;

    perform net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
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
    raise warning 'Push dispatch failed for notification % [%]: %', new.id, sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

commit;
