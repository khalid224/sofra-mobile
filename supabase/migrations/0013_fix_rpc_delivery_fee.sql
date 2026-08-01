-- ============================================================
-- 0013_fix_rpc_delivery_fee.sql
-- Fix place_order_atomic to dynamically pull delivery_fee from app_settings
-- Preserves ALL variants, extras, available_today, stock tracking, and return payload
-- ============================================================

create or replace function public.place_order_atomic(
  p_customer_id        uuid,
  p_payment_method     text,
  p_notes              text,
  p_items              jsonb,        -- [{meal_id, quantity, customer_notes, today_special_id?, variant_id?, extras?: [{id, name, price}]}]
  p_estimated_delivery timestamptz default null
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
  v_variant_id    uuid;
  v_extras        jsonb;
  v_qty           integer;
  v_notes         text;
  v_unit_price    numeric(10,2);
  v_meal_name     text;
  v_meal_image    text;
  v_variant_name  text;
  v_extras_cost   numeric(10,2) := 0;
  v_extra_item    jsonb;
  v_special_row   record;
  v_meal_row      record;
  v_variant_row   record;
  v_order_items   jsonb[] := '{}';
begin
  -- 1. Check restaurant availability
  if not public.is_restaurant_open() then
    raise exception 'عذراً، المطعم مغلق حالياً ولا يستقبل طلبات جديدة.';
  end if;

  -- 2. Dynamically fetch delivery fee from public.app_settings (safe extraction for numeric/string jsonb)
  select coalesce(
    nullif(trim(both '"' from value::text), '')::numeric,
    25
  ) into v_delivery_fee
  from public.app_settings
  where key = 'delivery_fee';

  if v_delivery_fee is null then v_delivery_fee := 25; end if;

  -- 3. Generate order number
  v_order_number := 'ORD-' || to_char(nextval('public.order_number_seq'), 'FM00000000');

  -- 4. Process items
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_meal_id    := (v_item->>'meal_id')::uuid;
    v_special_id := (v_item->>'today_special_id')::uuid;
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_extras     := v_item->'extras';
    v_qty        := (v_item->>'quantity')::integer;
    v_notes      := v_item->>'customer_notes';

    if v_qty is null or v_qty <= 0 then
      raise exception 'كمية غير صالحة للصنف %', v_meal_id;
    end if;

    v_extras_cost := 0;
    if v_extras is not null and jsonb_typeof(v_extras) = 'array' and jsonb_array_length(v_extras) > 0 then
      for v_extra_item in select * from jsonb_array_elements(v_extras) loop
        v_extras_cost := v_extras_cost + ((v_extra_item->>'price')::numeric);
      end loop;
    end if;

    -- Case A: Today Special item
    if v_special_id is not null then
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

      v_unit_price   := v_special_row.price + v_extras_cost;
      v_meal_name    := v_special_row.title;
      v_meal_image   := v_special_row.image_url;
      v_variant_name := null;

    -- Case B: Regular meal or variant
    else
      if v_variant_id is not null then
        select mv.name, coalesce(mv.image_url, m.image_url) as image_url, mv.price, mv.is_available, mv.track_stock, mv.stock_count, m.name as base_name, mv.is_deleted
          into v_variant_row
          from public.meal_variants mv
          join public.meals m on m.id = mv.meal_id
         where mv.id = v_variant_id;

        if not found or v_variant_row.is_deleted then
          raise exception 'الخيار المحدد غير موجود';
        end if;

        if not v_variant_row.is_available or (v_variant_row.track_stock and v_variant_row.stock_count is not null and v_variant_row.stock_count < v_qty) then
          raise exception 'الخيار % غير متاح حالياً أو نفذت الكمية', v_variant_row.name;
        end if;

        -- Decrement stock if stock tracking enabled
        if v_variant_row.track_stock and v_variant_row.stock_count is not null then
          update public.meal_variants
             set stock_count = stock_count - v_qty,
                 updated_at = now()
           where id = v_variant_id;
        end if;

        v_unit_price   := v_variant_row.price + v_extras_cost;
        v_meal_name    := v_variant_row.base_name || ' - ' || v_variant_row.name;
        v_meal_image   := v_variant_row.image_url;
        v_variant_name := v_variant_row.name;
      else
        select name, image_url, price, is_available, is_deleted into v_meal_row
          from public.meals
         where id = v_meal_id;

        if not found or v_meal_row.is_deleted then
          raise exception 'الصنف غير موجود';
        end if;

        if not v_meal_row.is_available then
          raise exception 'الصنف % غير متاح حالياً', v_meal_row.name;
        end if;

        v_unit_price   := v_meal_row.price + v_extras_cost;
        v_meal_name    := v_meal_row.name;
        v_meal_image   := v_meal_row.image_url;
        v_variant_name := null;
      end if;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    v_order_items := array_append(v_order_items, jsonb_build_object(
      'meal_id',          v_meal_id,
      'today_special_id', v_special_id,
      'variant_id',       v_variant_id,
      'variant_name',     v_variant_name,
      'selected_extras',  v_extras,
      'quantity',         v_qty,
      'unit_price',       v_unit_price,
      'total_price',      v_unit_price * v_qty,
      'customer_notes',   v_notes,
      'meal_name',        v_meal_name,
      'meal_image',       v_meal_image
    ));
  end loop;

  v_total := v_subtotal + v_delivery_fee;

  -- Create order
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

  -- Create order items
  insert into public.order_items (
    order_id, meal_id, today_special_id, variant_id, variant_name, selected_extras, quantity, unit_price, total_price, customer_notes, meal_name, meal_image
  )
  select v_order_id,
         (oi->>'meal_id')::uuid,
         (oi->>'today_special_id')::uuid,
         (oi->>'variant_id')::uuid,
         oi->>'variant_name',
         oi->'selected_extras',
         (oi->>'quantity')::integer,
         (oi->>'unit_price')::numeric,
         (oi->>'total_price')::numeric,
         oi->>'customer_notes',
         oi->>'meal_name',
         oi->>'meal_image'
    from unnest(v_order_items) as oi;

  -- Timeline
  insert into public.order_timeline (order_id, status, created_by, notes)
  values (v_order_id, 'pending_admin', coalesce(p_customer_id::text, 'system'), 'تم إنشاء الطلب');

  -- Notifications
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

  insert into public.notifications (user_id, title, body, type, is_read)
  select id, 'طلب جديد ! 📦', 'تم إنشاء الطلب رقم #' || v_order_number || ' وبانتظار المراجعة.', 'order_received', false
    from public.profiles
   where role = 'admin';

  return jsonb_build_object(
    'orderId',      v_order_id,
    'orderNumber',  v_order_number,
    'total',        v_total,
    'subtotal',     v_subtotal,
    'deliveryFee',  v_delivery_fee
  );
end;
$$;
