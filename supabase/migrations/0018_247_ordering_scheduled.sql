-- ============================================================
-- 0018_247_ordering_scheduled.sql
-- Phase 18: 24/7 Ordering System with Delivery Window & Scheduling
-- ============================================================

-- 1. Add scheduling columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NULL;

-- 2. Create index on scheduled_for for fast calendar & analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for ON public.orders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_orders_is_scheduled ON public.orders(is_scheduled);

-- 3. Seed ordering settings in app_settings if not existing
INSERT INTO public.app_settings (key, value) VALUES
  ('accept_orders_247',     'true'::jsonb),
  ('delivery_window_start', '"12:00"'::jsonb),
  ('delivery_window_end',   '"00:00"'::jsonb),
  ('prep_duration_minutes', '45'::jsonb),
  ('slot_interval_minutes', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Drop older versions of place_order_atomic if existing
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, text, text, jsonb, timestamptz);
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, text, text, jsonb, timestamptz, boolean, timestamptz);

-- 5. Create or replace place_order_atomic function for 24/7 ordering
CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_customer_id        uuid,
  p_payment_method     text,
  p_notes              text,
  p_items              jsonb,        -- [{meal_id, quantity, customer_notes, today_special_id?, variant_id?, extras?: [{id, name, price}]}]
  p_estimated_delivery timestamptz default null,
  p_is_scheduled       boolean default false,
  p_scheduled_for      timestamptz default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id          uuid;
  v_order_number      text;
  v_subtotal          numeric(10,2) := 0;
  v_delivery_fee      numeric(10,2) := 25;
  v_total             numeric(10,2);
  v_item              jsonb;
  v_meal_id           uuid;
  v_special_id        uuid;
  v_variant_id        uuid;
  v_extras            jsonb;
  v_qty               integer;
  v_notes             text;
  v_unit_price        numeric(10,2);
  v_meal_name         text;
  v_meal_image        text;
  v_variant_name      text;
  v_extras_cost       numeric(10,2) := 0;
  v_extra_item        jsonb;
  v_special_row       record;
  v_meal_row          record;
  v_variant_row       record;
  v_order_items       jsonb[] := '{}';
  v_accept_247        boolean := true;
  v_maintenance       boolean := false;
  v_effective_sched   timestamptz;
  v_is_scheduled      boolean := false;
  v_notif_body        text;
BEGIN
  -- 1. Check Maintenance Mode & 24/7 Ordering Toggle
  SELECT coalesce((value::text)::boolean, false) INTO v_maintenance
  FROM public.app_settings WHERE key = 'maintenance_mode';

  IF v_maintenance IS true THEN
    RAISE EXCEPTION 'المطعم في وضع الصيانة حالياً. لا يمكن استقبال طلبات في الوقت الحالي.';
  END IF;

  SELECT coalesce((value::text)::boolean, true) INTO v_accept_247
  FROM public.app_settings WHERE key = 'accept_orders_247';

  IF v_accept_247 IS false THEN
    IF NOT public.is_restaurant_open() THEN
      RAISE EXCEPTION 'عذراً، المطعم لا يستقبل طلبات حالياً.';
    END IF;
  END IF;

  -- 2. Determine scheduling state
  v_effective_sched := coalesce(p_scheduled_for, p_estimated_delivery);
  v_is_scheduled    := coalesce(p_is_scheduled, (v_effective_sched IS NOT NULL AND v_effective_sched > now() + interval '5 minutes'));

  -- 3. Dynamically fetch delivery fee from public.app_settings
  SELECT coalesce(
    nullif(trim(both '"' from value::text), '')::numeric,
    25
  ) INTO v_delivery_fee
  FROM public.app_settings
  WHERE key = 'delivery_fee';

  IF v_delivery_fee IS NULL THEN v_delivery_fee := 25; END IF;

  -- 4. Generate order number
  v_order_number := 'ORD-' || to_char(nextval('public.order_number_seq'), 'FM00000000');

  -- 5. Process items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_meal_id    := (v_item->>'meal_id')::uuid;
    v_special_id := (v_item->>'today_special_id')::uuid;
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_extras     := v_item->'extras';
    v_qty        := (v_item->>'quantity')::integer;
    v_notes      := v_item->>'customer_notes';

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'كمية غير صالحة للصنف %', v_meal_id;
    END IF;

    v_extras_cost := 0;
    IF v_extras IS NOT NULL AND jsonb_typeof(v_extras) = 'array' AND jsonb_array_length(v_extras) > 0 THEN
      FOR v_extra_item IN SELECT * FROM jsonb_array_elements(v_extras) LOOP
        v_extras_cost := v_extras_cost + ((v_extra_item->>'price')::numeric);
      END LOOP;
    END IF;

    -- Case A: Today Special item
    IF v_special_id IS NOT NULL THEN
      UPDATE public.available_today
         SET quantity = quantity - v_qty,
             updated_at = now()
       WHERE id = v_special_id
          AND is_active = true
          AND quantity >= v_qty
        RETURNING * INTO v_special_row;

      IF NOT found THEN
        RAISE EXCEPTION 'العرض اليومي غير متاح أو أن الكمية المطلوبة غير متوفرة';
      END IF;

      v_unit_price   := v_special_row.price + v_extras_cost;
      v_meal_name    := v_special_row.title;
      v_meal_image   := v_special_row.image_url;
      v_variant_name := NULL;

    -- Case B: Regular meal or variant
    ELSE
      IF v_variant_id IS NOT NULL THEN
        SELECT mv.name, coalesce(mv.image_url, m.image_url) AS image_url, mv.price, mv.is_available, mv.track_stock, mv.stock_count, m.name AS base_name, mv.is_deleted
          INTO v_variant_row
          FROM public.meal_variants mv
          JOIN public.meals m ON m.id = mv.meal_id
         WHERE mv.id = v_variant_id;

        IF NOT found OR v_variant_row.is_deleted THEN
          RAISE EXCEPTION 'الخيار المحدد غير موجود';
        END IF;

        IF NOT v_variant_row.is_available OR (v_variant_row.track_stock AND v_variant_row.stock_count IS NOT NULL AND v_variant_row.stock_count < v_qty) THEN
          RAISE EXCEPTION 'الخيار % غير متاح حالياً أو نفذت الكمية', v_variant_row.name;
        END IF;

        -- Decrement stock if stock tracking enabled
        IF v_variant_row.track_stock AND v_variant_row.stock_count IS NOT NULL THEN
          UPDATE public.meal_variants
             SET stock_count = stock_count - v_qty,
                 updated_at = now()
           WHERE id = v_variant_id;
        END IF;

        v_unit_price   := v_variant_row.price + v_extras_cost;
        v_meal_name    := v_variant_row.base_name || ' - ' || v_variant_row.name;
        v_meal_image   := v_variant_row.image_url;
        v_variant_name := v_variant_row.name;
      ELSE
        SELECT name, image_url, price, is_available, is_deleted INTO v_meal_row
          FROM public.meals
         WHERE id = v_meal_id;

        IF NOT found OR v_meal_row.is_deleted THEN
          RAISE EXCEPTION 'الصنف غير موجود';
        END IF;

        IF NOT v_meal_row.is_available THEN
          RAISE EXCEPTION 'الصنف % غير متاح حالياً', v_meal_row.name;
        END IF;

        v_unit_price   := v_meal_row.price + v_extras_cost;
        v_meal_name    := v_meal_row.name;
        v_meal_image   := v_meal_row.image_url;
        v_variant_name := NULL;
      END IF;
    END IF;

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
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;

  -- Create order with is_scheduled & scheduled_for
  INSERT INTO public.orders (
    customer_id, order_number, subtotal, delivery_fee,
    discount, tax, total, status, payment_method,
    payment_status, notes, estimated_delivery,
    is_scheduled, scheduled_for
  ) VALUES (
    p_customer_id, v_order_number, v_subtotal, v_delivery_fee,
    0, 0, v_total, 'pending_admin', p_payment_method,
    'pending', p_notes, v_effective_sched,
    v_is_scheduled, v_effective_sched
  )
  RETURNING id INTO v_order_id;

  -- Create order items
  INSERT INTO public.order_items (
    order_id, meal_id, today_special_id, variant_id, variant_name, selected_extras, quantity, unit_price, total_price, customer_notes, meal_name, meal_image
  )
  SELECT v_order_id,
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
    FROM unnest(v_order_items) AS oi;

  -- Timeline
  INSERT INTO public.order_timeline (order_id, status, created_by, notes)
  VALUES (
    v_order_id,
    'pending_admin',
    coalesce(p_customer_id::text, 'system'),
    CASE WHEN v_is_scheduled THEN 'تم إنشاء الطلب (مجدول للتجهيز)' ELSE 'تم إنشاء الطلب' END
  );

  -- Notifications
  IF v_is_scheduled THEN
    v_notif_body := 'تم استلام طلبك #' || v_order_number || ' بنجاح. سيبدأ تجهيز الطلب في الموعد المحدد (' || to_char(v_effective_sched AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ').';
  ELSE
    v_notif_body := 'طلبك #' || v_order_number || ' قيد المراجعة. سنتواصل معك قريباً.';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read)
    VALUES (
      p_customer_id,
      'تم استلام طلبك ✓',
      v_notif_body,
      'order_received',
      false
    );
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, is_read)
  SELECT id,
         CASE WHEN v_is_scheduled THEN 'طلب مجدول جديد 📅' ELSE 'طلب جديد 📦' END,
         'تم إنشاء الطلب رقم #' || v_order_number || ' وبانتظار المراجعة.',
         'order_received',
         false
    FROM public.profiles
   WHERE role = 'admin';

  RETURN jsonb_build_object(
    'orderId',      v_order_id,
    'orderNumber',  v_order_number,
    'total',        v_total,
    'subtotal',     v_subtotal,
    'deliveryFee',  v_delivery_fee,
    'isScheduled',  v_is_scheduled
  );
END;
$$;
