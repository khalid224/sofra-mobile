-- ============================================================
-- SOFRA — Abuse resilience, transactional dispatch and push queue
-- ============================================================

begin;

-- ── 1. Durable rate limits shared by every Edge Function instance ──────────
create table if not exists public.rate_limit_buckets (
  bucket_key text not null check (char_length(bucket_key) between 1 and 256),
  bucket_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, bucket_start)
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket_start timestamptz;
  v_count integer;
begin
  if p_bucket_key is null or char_length(p_bucket_key) not between 1 and 256
     or p_limit not between 1 and 10000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'INVALID_RATE_LIMIT_ARGUMENTS' using errcode = '22023';
  end if;

  v_bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets(bucket_key, bucket_start, request_count)
  values (p_bucket_key, v_bucket_start, 1)
  on conflict (bucket_key, bucket_start) do update
    set request_count = public.rate_limit_buckets.request_count + 1,
        updated_at = now()
    where public.rate_limit_buckets.request_count < p_limit
  returning request_count into v_count;

  if random() < 0.01 then
    delete from public.rate_limit_buckets
    where bucket_start < now() - interval '2 days';
  end if;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Every order path is protected in the database, even when the client calls
-- the RPC directly and bypasses the place-order Edge Function.
create index if not exists orders_customer_created_rate_idx
  on public.orders(customer_id, created_at desc);

create or replace function public.enforce_order_creation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if (select auth.role()) = 'service_role' or v_uid is null or public.is_admin() then
    return new;
  end if;

  if new.customer_id is distinct from v_uid then
    raise exception 'ORDER_CUSTOMER_MISMATCH' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('order-rate:' || v_uid::text, 0));
  if (
    select count(*)
    from public.orders
    where customer_id = v_uid
      and created_at >= now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'ORDER_RATE_LIMIT_EXCEEDED' using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_order_creation_rate_limit() from public, anon, authenticated;
drop trigger if exists trg_order_creation_rate_limit on public.orders;
create trigger trg_order_creation_rate_limit
  before insert on public.orders
  for each row execute function public.enforce_order_creation_rate_limit();

-- ── 2. Bound all customer-controlled write surfaces ────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_payload_check') then
    alter table public.chat_messages add constraint chat_messages_payload_check check (
      char_length(btrim(message)) between 1 and 2000
      and (attachment_url is null or char_length(attachment_url) <= 2048)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'complaints_payload_check') then
    alter table public.complaints add constraint complaints_payload_check check (
      char_length(btrim(title)) between 3 and 150
      and char_length(btrim(description)) between 10 and 4000
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customer_addresses_payload_check') then
    alter table public.customer_addresses add constraint customer_addresses_payload_check check (
      char_length(btrim(title)) between 1 and 80
      and char_length(btrim(city)) between 1 and 120
      and char_length(btrim(area)) between 1 and 120
      and char_length(btrim(street)) between 1 and 250
      and (building is null or char_length(building) <= 80)
      and (floor is null or char_length(floor) <= 40)
      and (apartment is null or char_length(apartment) <= 40)
      and (landmark is null or char_length(landmark) <= 250)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'device_tokens_payload_check') then
    alter table public.device_tokens add constraint device_tokens_payload_check check (
      char_length(token) between 10 and 512
    ) not valid;
  end if;
end;
$$;

create or replace function public.enforce_customer_write_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if (select auth.role()) = 'service_role' or public.is_admin() then
    return new;
  end if;
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if tg_table_name = 'customer_addresses' then
    if new.customer_id is distinct from v_uid then
      raise exception 'ADDRESS_OWNER_MISMATCH' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('addresses:' || v_uid::text, 0));
    if (select count(*) from public.customer_addresses where customer_id = v_uid) >= 5 then
      raise exception 'ADDRESS_LIMIT_EXCEEDED' using errcode = '54000';
    end if;
  elsif tg_table_name = 'device_tokens' then
    if new.user_id is distinct from v_uid then
      raise exception 'DEVICE_TOKEN_OWNER_MISMATCH' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('device-tokens:' || v_uid::text, 0));
    if (select count(*) from public.device_tokens where user_id = v_uid) >= 5 then
      raise exception 'DEVICE_TOKEN_LIMIT_EXCEEDED' using errcode = '54000';
    end if;
  elsif tg_table_name = 'complaints' then
    if new.customer_id is distinct from v_uid or not exists (
      select 1 from public.orders o
      where o.id = new.order_id and o.customer_id = v_uid
    ) then
      raise exception 'COMPLAINT_ORDER_NOT_OWNED' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('complaints:' || v_uid::text, 0));
    if (
      select count(*) from public.complaints
      where customer_id = v_uid and created_at >= now() - interval '1 day'
    ) >= 3 then
      raise exception 'COMPLAINT_RATE_LIMIT_EXCEEDED' using errcode = '54000';
    end if;
  elsif tg_table_name = 'chat_messages' and new.sender_type = 'customer' then
    select customer_id into v_owner from public.chat_threads where id = new.thread_id;
    if v_owner is distinct from v_uid then
      raise exception 'CHAT_THREAD_NOT_OWNED' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('chat:' || v_uid::text, 0));
    if (
      select count(*)
      from public.chat_messages m
      join public.chat_threads t on t.id = m.thread_id
      where t.customer_id = v_uid
        and m.sender_type = 'customer'
        and m.created_at >= now() - interval '1 minute'
    ) >= 15 then
      raise exception 'CHAT_RATE_LIMIT_EXCEEDED' using errcode = '54000';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_customer_write_limits() from public, anon, authenticated;

drop trigger if exists trg_customer_addresses_limits on public.customer_addresses;
create trigger trg_customer_addresses_limits before insert on public.customer_addresses
  for each row execute function public.enforce_customer_write_limits();
drop trigger if exists trg_device_tokens_limits on public.device_tokens;
create trigger trg_device_tokens_limits before insert on public.device_tokens
  for each row execute function public.enforce_customer_write_limits();
drop trigger if exists trg_complaints_limits on public.complaints;
create trigger trg_complaints_limits before insert on public.complaints
  for each row execute function public.enforce_customer_write_limits();
drop trigger if exists trg_chat_messages_limits on public.chat_messages;
create trigger trg_chat_messages_limits before insert on public.chat_messages
  for each row execute function public.enforce_customer_write_limits();

drop policy if exists "complaints_insert_own" on public.complaints;
drop policy if exists "complaints_insert_customer_owned_order" on public.complaints;
create policy "complaints_insert_customer_owned_order"
  on public.complaints for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = complaints.order_id and o.customer_id = (select auth.uid())
    )
  );

-- ── 3. Transactional cook assignment and aggregated workload ───────────────
with ranked_attempts as (
  select
    id,
    row_number() over (
      partition by order_id
      order by coalesce(sent_at, created_at), created_at, id
    )::integer as corrected_attempt_number
  from public.dispatch_history
)
update public.dispatch_history d
set attempt_number = r.corrected_attempt_number
from ranked_attempts r
where d.id = r.id and d.attempt_number is distinct from r.corrected_attempt_number;

create unique index if not exists dispatch_history_order_attempt_uidx
  on public.dispatch_history(order_id, attempt_number);

create or replace function public.get_cook_workloads()
returns table(cook_id uuid, active_orders bigint)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select o.cook_id, count(*)::bigint
  from public.orders o
  where o.status in ('accepted', 'preparing', 'ready')
    and o.cook_id is not null
  group by o.cook_id;
$$;

revoke all on function public.get_cook_workloads() from public, anon, authenticated;
grant execute on function public.get_cook_workloads() to service_role;

create or replace function public.assign_cook_atomic(
  p_order_id uuid,
  p_cook_id uuid,
  p_admin_id uuid
)
returns table(attempt_number integer, order_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_attempt integer;
  v_cook_name text;
  v_last_status text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'ACTIVE_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;

  select status into v_last_status
  from public.dispatch_history
  where order_id = p_order_id
  order by attempt_number desc
  limit 1;

  if v_order.status not in ('pending_admin', 'dispatching')
     and not (v_order.status = 'waiting_cook' and v_last_status in ('rejected', 'no_response')) then
    raise exception 'ORDER_NOT_ASSIGNABLE' using errcode = '55000';
  end if;

  select full_name into v_cook_name
  from public.cooks
  where id = p_cook_id and status in ('available', 'busy')
  for update;
  if not found then raise exception 'COOK_NOT_AVAILABLE' using errcode = '55000'; end if;

  select coalesce(max(d.attempt_number), 0) + 1 into v_attempt
  from public.dispatch_history d where d.order_id = p_order_id;

  update public.orders
  set cook_id = p_cook_id, status = 'waiting_cook', updated_at = now()
  where id = p_order_id;

  insert into public.dispatch_history(order_id, cook_id, attempt_number, status, sent_at)
  values (p_order_id, p_cook_id, v_attempt, 'sent', now());

  insert into public.order_timeline(order_id, status, created_by, notes)
  values (
    p_order_id,
    'waiting_cook',
    p_admin_id::text,
    'تم إرسال الطلب للطاهي ' || v_cook_name || ' — المحاولة #' || v_attempt
  );

  return query select v_attempt, 'waiting_cook'::text;
end;
$$;

revoke all on function public.assign_cook_atomic(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_cook_atomic(uuid, uuid, uuid) to service_role;

-- ── 4. Broadcast queue: one job, then bounded batches ──────────────────────
create table if not exists public.broadcast_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('today_special')),
  source_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384),
  cursor_user_id uuid,
  processed_count integer not null default 0 check (processed_count >= 0),
  failure_count integer not null default 0 check (failure_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_type, source_id)
);

create index if not exists broadcast_jobs_due_idx
  on public.broadcast_jobs(status, next_attempt_at, created_at);
alter table public.broadcast_jobs enable row level security;
revoke all on public.broadcast_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.broadcast_jobs to service_role;

drop policy if exists "broadcast_jobs_admin_select" on public.broadcast_jobs;
create policy "broadcast_jobs_admin_select" on public.broadcast_jobs
  for select to authenticated using (public.is_admin());
grant select on public.broadcast_jobs to authenticated;

create or replace function public.enqueue_today_special_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (tg_op = 'INSERT' and new.is_active)
     or (tg_op = 'UPDATE' and new.is_active and not coalesce(old.is_active, false)) then
    insert into public.broadcast_jobs(job_type, source_id, payload)
    values (
      'today_special',
      new.id,
      jsonb_build_object(
        'title', '⚡ عرض جديد في عروض اليوم!',
        'body', 'طبق جديد متاح الآن: ' || new.title || ' بسعر ' || new.price::text || ' جنيه',
        'notification_type', 'today_special',
        'data', jsonb_build_object('today_special_id', new.id, 'screen', '/(tabs)/menu')
      )
    )
    on conflict (job_type, source_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_today_special_broadcast() from public, anon, authenticated;
drop trigger if exists trg_today_special_published on public.available_today;
drop trigger if exists trg_enqueue_today_special_broadcast on public.available_today;
create trigger trg_enqueue_today_special_broadcast
  after insert or update on public.available_today
  for each row execute function public.enqueue_today_special_broadcast();

create or replace function public.claim_next_broadcast_job()
returns setof public.broadcast_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.broadcast_jobs
  where failure_count < 5
    and next_attempt_at <= now()
    and (status = 'pending' or (status = 'processing' and locked_at < now() - interval '5 minutes'))
  order by created_at
  for update skip locked
  limit 1;

  if v_id is null then return; end if;

  return query
  update public.broadcast_jobs
  set status = 'processing', locked_at = now(), updated_at = now()
  where id = v_id
  returning *;
end;
$$;

revoke all on function public.claim_next_broadcast_job() from public, anon, authenticated;
grant execute on function public.claim_next_broadcast_job() to service_role;

alter table public.notifications
  add column if not exists broadcast_job_id uuid references public.broadcast_jobs(id) on delete set null;
create unique index if not exists notifications_user_broadcast_uidx
  on public.notifications(user_id, broadcast_job_id);

-- Broadcast rows are delivered by the batch worker. Ordinary transactional
-- notifications keep the existing single-recipient dispatcher.
create or replace function public.dispatch_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_function_url constant text :=
    'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_webhook_secret text;
begin
  if new.broadcast_job_id is not null or coalesce(new.data, '{}'::jsonb) ? 'broadcast_job_id' then
    return new;
  end if;

  begin
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

    if v_webhook_secret is null or length(v_webhook_secret) < 32 then
      raise warning 'Push dispatch skipped for notification %: webhook secret missing', new.id;
      return new;
    end if;

    perform net.http_post(
      url := v_function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
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

drop trigger if exists trg_dispatch_push_on_notification on public.notifications;
create trigger trg_dispatch_push_on_notification
  after insert on public.notifications
  for each row execute function public.dispatch_push_on_notification_insert();

create extension if not exists pg_cron;

create or replace function public.invoke_broadcast_worker()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_cron_secret text;
begin
  begin
    select decrypted_secret into v_cron_secret
    from vault.decrypted_secrets where name = 'cron_secret' limit 1;
    if v_cron_secret is null or length(v_cron_secret) < 32 then
      raise warning 'Broadcast worker skipped: cron_secret is missing';
      return;
    end if;
    perform net.http_post(
      url := 'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/process-broadcast-jobs',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'Broadcast worker invocation failed [%]: %', sqlstate, sqlerrm;
  end;
end;
$$;

revoke all on function public.invoke_broadcast_worker() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sofra-process-broadcast-jobs') then
    perform cron.schedule(
      'sofra-process-broadcast-jobs',
      '* * * * *',
      'select public.invoke_broadcast_worker()'
    );
  end if;
end;
$$;

-- ── 5. Advisor hardening and least privilege ───────────────────────────────
create index if not exists analytics_events_user_created_idx
  on public.analytics_events(user_id, created_at desc);

create or replace function public.get_admin_dashboard_snapshot(
  p_today_start timestamptz,
  p_month_start timestamptz
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with order_metrics as (
    select
      count(*) filter (where created_at >= p_today_start)::integer as orders_today,
      count(*) filter (where created_at >= p_today_start and status = 'delivered')::integer as delivered_today,
      count(*) filter (where created_at >= p_today_start and status = 'cancelled')::integer as cancelled_today,
      count(*) filter (where created_at >= p_month_start)::integer as orders_month,
      count(*) filter (where created_at >= p_month_start and status = 'cancelled')::integer as cancelled_month,
      count(*) filter (where status = 'pending_admin')::integer as pending_orders,
      count(*) filter (where status in ('accepted', 'preparing', 'ready'))::integer as preparing_orders,
      coalesce(sum(total) filter (where created_at >= p_today_start and status = 'delivered'), 0) as revenue_today,
      coalesce(sum(total) filter (where created_at >= p_month_start and status = 'delivered'), 0) as revenue_month
    from public.orders
  ),
  recent as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) as rows
    from (
      select id, order_number, total, status, created_at, customer_id
      from public.orders order by created_at desc limit 10
    ) r
  ),
  top_meals as (
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', item_count) order by item_count desc), '[]'::jsonb) as rows
    from (
      select m.name, sum(oi.quantity)::integer as item_count
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.meals m on m.id = oi.meal_id
      where o.created_at >= p_month_start
      group by m.id, m.name
      order by item_count desc
      limit 5
    ) ranked
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'revenue_today', om.revenue_today,
      'revenue_month', om.revenue_month,
      'orders_today', om.orders_today,
      'avg_order_value', case when om.delivered_today > 0 then round(om.revenue_today / om.delivered_today) else 0 end,
      'pending_orders', om.pending_orders,
      'preparing_orders', om.preparing_orders,
      'delivered_today', om.delivered_today,
      'cancelled_today', om.cancelled_today,
      'acceptance_rate', case when om.orders_month > 0 then round(((om.orders_month - om.cancelled_month)::numeric / om.orders_month) * 100) else 0 end,
      'open_complaints', (select count(*) from public.complaints where status = 'open'),
      'unread_chats', (select count(*) from public.chat_threads where unread_count > 0),
      'active_cooks', (select count(*) from public.cooks where status = 'available'),
      'new_customers_month', (select count(*) from public.profiles where role = 'customer' and created_at >= p_month_start)
    ),
    'recent_orders', recent.rows,
    'top_meals', top_meals.rows,
    'generated_at', now()
  )
  from order_metrics om cross join recent cross join top_meals;
$$;

revoke all on function public.get_admin_dashboard_snapshot(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_snapshot(timestamptz, timestamptz) to service_role;

alter function public.handle_updated_at() set search_path = public, pg_temp;
alter function public.enforce_single_default_variant() set search_path = public, pg_temp;

drop policy if exists "meal_variants_select" on public.meal_variants;
create policy "meal_variants_select" on public.meal_variants for select
  using ((is_available = true and is_deleted = false) or public.is_admin());

drop policy if exists "meal_variant_extras_select" on public.meal_variant_extras;
create policy "meal_variant_extras_select" on public.meal_variant_extras for select
  using (
    (is_available = true and is_deleted = false and exists (
      select 1 from public.meal_variants v
      where v.id = meal_variant_extras.variant_id
        and v.is_available = true and v.is_deleted = false
    )) or public.is_admin()
  );

revoke insert, update, delete, truncate, references, trigger
  on public.meal_variants, public.meal_variant_extras from anon;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
  end loop;
end;
$$;

-- assigned_cook_id was backfilled into cook_id in migration 0021 and has no
-- remaining application readers. prep_status remains until kitchen-calendar
-- is redesigned around canonical order status.
drop index if exists public.idx_orders_assigned_cook;
alter table public.orders drop column if exists assigned_cook_id;

commit;
