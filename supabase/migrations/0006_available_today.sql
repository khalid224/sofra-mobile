-- ============================================================
-- SOFRA ENTERPRISE — Available Today Specials + Atomic Orders (Production-Ready)
-- Version: 2.0 — Migration 0006
-- Rule 7: Every database modification must be a migration
-- ============================================================

-- Create order number sequence for safe, non-colliding order numbers
create sequence if not exists public.order_number_seq start with 100000;

-- ============================================================
-- AVAILABLE TODAY TABLE (Snapshot-based with Category)
-- ============================================================
create table if not exists public.available_today (
  id              uuid primary key default gen_random_uuid(),
  meal_id         uuid references public.meals(id) on delete set null,
  -- Snapshot columns — independent from the original meal
  title           text not null,
  description     text,
  image_url       text,
  price           numeric(10, 2) not null check (price > 0), -- Constraint: price > 0 (Free meals blocked)
  quantity        integer not null default 0 check (quantity >= 0),
  -- Status: managed by trigger automatically (only 'available' or 'sold_out')
  status          text not null default 'available' check (status in ('available', 'sold_out')),
  is_active       boolean not null default true,
  -- Scheduling window
  start_time      time,        -- e.g. 10:00:00 — null means no restriction
  end_time        time,        -- e.g. 16:00:00 — null means no restriction
  expiration_date timestamptz, -- full datetime expiry (overrides end_time)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists available_today_active_idx  on public.available_today(is_active);
create index if not exists available_today_status_idx  on public.available_today(status);
create index if not exists available_today_meal_idx    on public.available_today(meal_id);
create index if not exists available_today_created_idx on public.available_today(created_at desc);
create index if not exists available_today_expiry_idx  on public.available_today(expiration_date);

-- ─── updated_at trigger ──────────────────────────────────────
drop trigger if exists set_updated_at on public.available_today;
create trigger set_updated_at
  before update on public.available_today
  for each row execute function public.handle_updated_at();

-- ============================================================
-- DYNAMIC AVAILABILITY & TIME WINDOW FUNCTION (Supports Cross-Midnight)
-- ============================================================
create or replace function public.is_special_available(p_id uuid)
returns boolean language plpgsql stable security definer as $$
declare
  v_row record;
  v_now_time time := localtime;
  v_now_ts   timestamptz := now();
begin
  select * into v_row from public.available_today where id = p_id;
  if not found then return false; end if;
  
  -- Check active state & stock quantity
  if not v_row.is_active or v_row.quantity <= 0 then
    return false;
  end if;
  
  -- Expiration check
  if v_row.expiration_date is not null and v_row.expiration_date <= v_now_ts then
    return false;
  end if;
  
  -- Time window check supporting cross-midnight (e.g. 8 PM to 2 AM)
  if v_row.start_time is not null and v_row.end_time is not null then
    if v_row.start_time <= v_row.end_time then
      -- Standard window
      if not (v_now_time >= v_row.start_time and v_now_time <= v_row.end_time) then
        return false;
      end if;
    else
      -- Cross-midnight window
      if not (v_now_time >= v_row.start_time or v_now_time <= v_row.end_time) then
        return false;
      end if;
    end if;
  end if;
  
  return true;
end;
$$;

-- ============================================================
-- AUTO-STATUS TRIGGER (available / sold_out)
-- ============================================================
create or replace function public.handle_available_today_status()
returns trigger language plpgsql security definer as $$
begin
  if new.quantity <= 0 then
    new.status := 'sold_out';
  else
    new.status := 'available';
  end if;
  return new;
end;
$$;

drop trigger if exists set_available_today_status on public.available_today;
create trigger set_available_today_status
  before insert or update on public.available_today
  for each row execute function public.handle_available_today_status();

-- ============================================================
-- ORDER ITEMS EXTENSION
-- ============================================================
alter table public.order_items 
  add column if not exists today_special_id uuid references public.available_today(id) on delete set null,
  add column if not exists meal_name text,
  add column if not exists meal_image text;

-- ============================================================
-- RESTAURANT STATUS helper functions
-- ============================================================
create or replace function public.is_restaurant_open()
returns boolean language plpgsql stable security definer as $$
declare
  v_is_open text;
  v_open text;
  v_close text;
  v_now_time time := localtime;
begin
  select value::text into v_is_open from public.app_settings where key = 'restaurant_is_open';
  if v_is_open = '"false"' or v_is_open = 'false' then return false; end if;
  
  select value::text into v_open from public.app_settings where key = 'restaurant_open_time';
  select value::text into v_close from public.app_settings where key = 'restaurant_close_time';
  
  -- Strip quotes
  v_open  := replace(v_open, '"', '');
  v_close := replace(v_close, '"', '');
  
  if v_open is not null and v_close is not null then
    if v_open::time <= v_close::time then
      return (v_now_time >= v_open::time and v_now_time <= v_close::time);
    else
      return (v_now_time >= v_open::time or v_now_time <= v_close::time);
    end if;
  end if;
  
  return true;
end;
$$;

-- ============================================================
-- ATOMIC ORDER PLACEMENT RPC (RETURNING inventory decrement)
-- ============================================================
create or replace function public.place_order_atomic(
  p_customer_id        uuid,
  p_payment_method     text,
  p_notes              text,
  p_items              jsonb,        -- [{meal_id, quantity, customer_notes, today_special_id?}]
  p_estimated_delivery timestamptz default null  -- null = Today Specials (immediate)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id      uuid;
  v_order_number  text;
  v_subtotal      numeric(10,2) := 0;
  v_delivery_fee  numeric(10,2) := 25;
  v_total         numeric(10,2);
  v_item          jsonb;
  v_meal_id       uuid;
  v_special_id    uuid;
  v_qty           integer;
  v_notes         text;
  v_unit_price    numeric(10,2);
  v_meal_name     text;
  v_meal_image    text;
  v_special_row   record;
  v_meal_row      record;
  v_order_items   jsonb[] := '{}';
begin
  -- ── Check restaurant availability first ──────────────────
  if not public.is_restaurant_open() then
    raise exception 'عذراً، المطعم مغلق حالياً ولا يستقبل طلبات جديدة.';
  end if;

  -- ── Fetch delivery fee ────────────────────────────────────
  select (value::text)::numeric into v_delivery_fee
    from public.app_settings
   where key = 'delivery_fee';
  if v_delivery_fee is null then v_delivery_fee := 25; end if;

  -- ── Generate sequence-based order number ──────────────────
  v_order_number := 'ORD-' || to_char(nextval('public.order_number_seq'), 'FM00000000');

  -- ── Process items ─────────────────────────────────────────
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_meal_id    := (v_item->>'meal_id')::uuid;
    v_special_id := (v_item->>'today_special_id')::uuid;  -- nullable
    v_qty        := (v_item->>'quantity')::integer;
    v_notes      := v_item->>'customer_notes';

    if v_qty is null or v_qty <= 0 then
      raise exception 'كمية غير صالحة للصنف %', v_meal_id;
    end if;

    -- ── Case A: Today Special item ──────────────────────────
    if v_special_id is not null then
      -- Single update decrement with stock validity checks (Atomic & RETURNING)
      update public.available_today
         set quantity = quantity - v_qty,
             updated_at = now()
       where id = v_special_id
         and is_active = true
         and public.is_special_available(id)
         and quantity >= v_qty
       returning * into v_special_row;

      if not found then
        raise exception 'العرض اليومي غير متاح أو أن الكمية المطلوبة غير متوفرة';
      end if;

      v_unit_price := v_special_row.price;
      v_meal_name  := v_special_row.title;
      v_meal_image := v_special_row.image_url;

    -- ── Case B: Regular meal ────────────────────────────────
    else
      select name, image_url, price, is_available into v_meal_row
        from public.meals
       where id = v_meal_id;

      if not found then
        raise exception 'الصنف غير موجود';
      end if;

      if not v_meal_row.is_available then
        raise exception 'الصنف % غير متاح حالياً', v_meal_row.name;
      end if;

      v_unit_price := v_meal_row.price;
      v_meal_name  := v_meal_row.name;
      v_meal_image := v_meal_row.image_url;
    end if;

    -- Accumulate subtotal
    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    -- Build order item record with snapshot values
    v_order_items := array_append(v_order_items, jsonb_build_object(
      'meal_id',          v_meal_id,
      'today_special_id', v_special_id,
      'quantity',         v_qty,
      'unit_price',       v_unit_price,
      'total_price',      v_unit_price * v_qty,
      'customer_notes',   v_notes,
      'meal_name',        v_meal_name,
      'meal_image',       v_meal_image
    ));
  end loop;

  v_total := v_subtotal + v_delivery_fee;

  -- ── Create order ──────────────────────────────────────────
  insert into public.orders (
    customer_id, order_number, subtotal, delivery_fee,
    discount, tax, total, status, payment_method,
    payment_status, notes, estimated_delivery
  ) values (
    p_customer_id, v_order_number, v_subtotal, v_delivery_fee,
    0, 0, v_total, 'pending_admin', p_payment_method,
    'pending', p_notes, p_estimated_delivery
  )
  returning id into v_order_id;

  -- ── Create order items (with frozen name and image snapshot) ──
  insert into public.order_items (
    order_id, meal_id, today_special_id, quantity, unit_price, total_price, customer_notes, meal_name, meal_image
  )
  select v_order_id,
         (oi->>'meal_id')::uuid,
         (oi->>'today_special_id')::uuid,
         (oi->>'quantity')::integer,
         (oi->>'unit_price')::numeric,
         (oi->>'total_price')::numeric,
         oi->>'customer_notes',
         oi->>'meal_name',
         oi->>'meal_image'
    from unnest(v_order_items) as oi;

  -- ── Initial timeline entry ────────────────────────────────
  insert into public.order_timeline (order_id, status, created_by, notes)
  values (v_order_id, 'pending_admin', coalesce(p_customer_id::text, 'system'), 'تم إنشاء الطلب');

  -- ── Customer notification ─────────────────────────────────
  if p_customer_id is not null then
    insert into public.notifications (user_id, title, body, type, is_read)
    values (
      p_customer_id,
      'تم استلام طلبك ✓',
      'طلبك #' || v_order_number || ' قيد المراجعة. سنتواصل معك قريباً.',
      'order_received',
      false
    );
  end if;

  -- ── Admin notification ──
  insert into public.notifications (user_id, title, body, type, is_read)
  select id, 'طلب جديد ! 📦', 'تم إنشاء الطلب رقم #' || v_order_number || ' وبانتظار المراجعة.', 'order_received', false
    from public.profiles
   where role = 'admin';

  -- ── Return success payload ────────────────────────────────
  return jsonb_build_object(
    'orderId',      v_order_id,
    'orderNumber',  v_order_number,
    'total',        v_total,
    'subtotal',     v_subtotal,
    'deliveryFee',  v_delivery_fee
  );

exception
  when others then
    raise; -- Re-raise to roll back the transaction
end;
$$;

-- Grant RPC execution to authenticated users
grant execute on function public.place_order_atomic(uuid, text, text, jsonb, timestamptz) to authenticated;

-- ============================================================
-- RLS FOR available_today (Explicit Precedence)
-- ============================================================
alter table public.available_today enable row level security;

-- Public can read active, non-expired items
drop policy if exists "available_today_select" on public.available_today;
create policy "available_today_select" on public.available_today
  for select using (
    (public.is_special_available(id))
    or 
    (public.is_admin())
  );

-- Admin has full write access
drop policy if exists "available_today_admin_write" on public.available_today;
create policy "available_today_admin_write" on public.available_today
  for all using (
    public.is_admin()
  );

-- Precise SQL Grants (No 'GRANT ALL' wildcard)
revoke all on public.available_today from public, authenticated, anon;
grant select on public.available_today to anon, authenticated;
grant insert, update, delete on public.available_today to authenticated;

-- ============================================================
-- RESTAURANT STATUS settings defaults
-- ============================================================
insert into public.app_settings (key, value, description) values
  ('restaurant_is_open',    'true',                   'هل المطعم مفتوح الآن'),
  ('restaurant_open_time',  '"09:00"',                'وقت فتح المطعم'),
  ('restaurant_close_time', '"22:00"',                'وقت إغلاق المطعم'),
  ('restaurant_closed_msg', '"مغلق حالياً. يفتح الساعة 9 صباحاً"', 'رسالة الإغلاق')
on conflict (key) do nothing;
