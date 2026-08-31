-- ============================================================
-- 0021_secure_order_fulfillment_notifications.sql
-- Secure order placement, immutable delivery snapshots, one status pipeline
-- ============================================================

-- Keep the fulfillment data that was entered at checkout on the order itself.
-- This is intentionally a snapshot: later profile/address edits must not change
-- the address of an already placed order.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_name    text,
  ADD COLUMN IF NOT EXISTS delivery_phone   text,
  ADD COLUMN IF NOT EXISTS delivery_email   text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_city    text,
  ADD COLUMN IF NOT EXISTS delivery_area    text;

-- A custom Today Special can be a snapshot without a backing meal row.
ALTER TABLE public.order_items ALTER COLUMN meal_id DROP NOT NULL;

-- The kitchen planner introduced a second cook reference. Preserve any value
-- already stored there, then use orders.cook_id as the single canonical field.
UPDATE public.orders
SET cook_id = assigned_cook_id
WHERE cook_id IS NULL AND assigned_cook_id IS NOT NULL;

-- Order rows can only be created through the verified RPC (or by an admin).
-- The previous policies allowed an authenticated customer to insert arbitrary
-- totals and item prices directly into the three order tables.
DROP POLICY IF EXISTS "orders_insert_service" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_user" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_admin" ON public.orders;
CREATE POLICY "orders_insert_admin" ON public.orders
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_user" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_admin" ON public.order_items;
CREATE POLICY "order_items_insert_admin" ON public.order_items
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "order_timeline_insert" ON public.order_timeline;
DROP POLICY IF EXISTS "order_timeline_insert_user" ON public.order_timeline;
DROP POLICY IF EXISTS "order_timeline_insert_admin" ON public.order_timeline;
CREATE POLICY "order_timeline_insert_admin" ON public.order_timeline
  FOR INSERT WITH CHECK (public.is_admin());

-- Remove every legacy callable overload. The old functions accepted an
-- arbitrary customer id and client-provided extra prices.
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, text, text, jsonb, timestamptz);
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, text, text, jsonb, timestamptz, boolean, timestamptz);

CREATE OR REPLACE FUNCTION public.place_order_atomic_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id       uuid := auth.uid();
  v_order_id          uuid;
  v_order_number      text;
  v_payment_method    text := coalesce(p_payload->>'payment_method', 'cash');
  v_notes             text := nullif(trim(p_payload->>'notes'), '');
  v_items             jsonb := p_payload->'items';
  v_item              jsonb;
  v_meal_id           uuid;
  v_special_id        uuid;
  v_variant_id        uuid;
  v_extra_id          uuid;
  v_qty               integer;
  v_item_notes        text;
  v_subtotal          numeric(10,2) := 0;
  v_delivery_fee      numeric(10,2) := 25;
  v_unit_price        numeric(10,2);
  v_extras_cost       numeric(10,2);
  v_total             numeric(10,2);
  v_meal_name         text;
  v_meal_image        text;
  v_variant_name      text;
  v_extras            jsonb;
  v_verified_extras   jsonb;
  v_extra_item        jsonb;
  v_extra_row         record;
  v_special_row       record;
  v_meal_row          record;
  v_variant_row       record;
  v_order_items       jsonb := '[]'::jsonb;
  v_effective_sched   timestamptz;
  v_is_scheduled      boolean;
  v_maintenance       boolean := false;
  v_accept_247        boolean := true;
  v_delivery_name     text := trim(p_payload#>>'{delivery,name}');
  v_delivery_phone    text := trim(p_payload#>>'{delivery,phone}');
  v_delivery_email    text := nullif(trim(p_payload#>>'{delivery,email}'), '');
  v_delivery_address  text := trim(p_payload#>>'{delivery,address}');
  v_delivery_city     text := trim(p_payload#>>'{delivery,city}');
  v_delivery_area     text := trim(p_payload#>>'{delivery,area}');
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول قبل إتمام الطلب';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_customer_id AND status = 'active' AND role IN ('customer', 'admin')
  ) THEN
    RAISE EXCEPTION 'الحساب غير نشط أو غير مسموح له بإنشاء طلب';
  END IF;

  -- Card and wallet are disabled until a verified payment provider is wired in.
  IF v_payment_method <> 'cash' THEN
    RAISE EXCEPTION 'طريقة الدفع المختارة غير متاحة حالياً';
  END IF;

  IF coalesce(length(v_delivery_name), 0) < 2
     OR coalesce(length(v_delivery_phone), 0) < 10
     OR coalesce(length(v_delivery_address), 0) < 5
     OR coalesce(length(v_delivery_city), 0) < 2
     OR coalesce(length(v_delivery_area), 0) < 2 THEN
    RAISE EXCEPTION 'بيانات التوصيل غير مكتملة';
  END IF;
  IF length(v_delivery_name) > 120 OR length(v_delivery_phone) > 30
     OR coalesce(length(v_delivery_email), 0) > 254
     OR length(v_delivery_address) > 500 OR length(v_delivery_city) > 120
     OR length(v_delivery_area) > 120 OR coalesce(length(v_notes), 0) > 1000 THEN
    RAISE EXCEPTION 'بيانات الطلب أطول من الحد المسموح';
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array'
     OR jsonb_array_length(v_items) < 1 OR jsonb_array_length(v_items) > 30 THEN
    RAISE EXCEPTION 'السلة غير صالحة';
  END IF;

  SELECT coalesce((value::text)::boolean, false)
    INTO v_maintenance FROM public.app_settings WHERE key = 'maintenance_mode';
  IF v_maintenance THEN
    RAISE EXCEPTION 'المطعم في وضع الصيانة حالياً';
  END IF;

  SELECT coalesce((value::text)::boolean, true)
    INTO v_accept_247 FROM public.app_settings WHERE key = 'accept_orders_247';
  IF NOT v_accept_247 AND NOT public.is_restaurant_open() THEN
    RAISE EXCEPTION 'عذراً، المطعم لا يستقبل طلبات حالياً';
  END IF;

  SELECT coalesce(nullif(trim(both '"' from value::text), '')::numeric, 25)
    INTO v_delivery_fee FROM public.app_settings WHERE key = 'delivery_fee';
  v_delivery_fee := coalesce(v_delivery_fee, 25);

  v_effective_sched := nullif(p_payload->>'scheduled_for', '')::timestamptz;
  v_is_scheduled := coalesce((p_payload->>'is_scheduled')::boolean, false);
  IF v_effective_sched IS NOT NULL AND v_effective_sched < now() + interval '5 minutes' THEN
    v_is_scheduled := false;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_meal_id := nullif(v_item->>'meal_id', '')::uuid;
    v_special_id := nullif(v_item->>'today_special_id', '')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := nullif(v_item->>'quantity', '')::integer;
    v_item_notes := nullif(trim(v_item->>'customer_notes'), '');
    v_extras := coalesce(v_item->'extras', '[]'::jsonb);
    v_verified_extras := '[]'::jsonb;
    v_extras_cost := 0;

    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 20 THEN
      RAISE EXCEPTION 'كمية غير صالحة';
    END IF;
    IF coalesce(length(v_item_notes), 0) > 500 THEN
      RAISE EXCEPTION 'ملاحظات الصنف أطول من الحد المسموح';
    END IF;
    IF jsonb_typeof(v_extras) <> 'array' THEN
      RAISE EXCEPTION 'بيانات الإضافات غير صالحة';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(v_extras)) <>
       (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(v_extras)) THEN
      RAISE EXCEPTION 'لا يمكن تكرار نفس الإضافة';
    END IF;

    IF v_special_id IS NOT NULL THEN
      IF v_variant_id IS NOT NULL OR jsonb_array_length(v_extras) > 0 THEN
        RAISE EXCEPTION 'العرض اليومي لا يقبل خيارات أو إضافات';
      END IF;

      SELECT * INTO v_special_row
      FROM public.available_today
      WHERE id = v_special_id
      FOR UPDATE;

      IF NOT found OR NOT v_special_row.is_active OR v_special_row.status <> 'available'
         OR v_special_row.quantity < v_qty OR NOT public.is_special_available(v_special_id) THEN
        RAISE EXCEPTION 'العرض اليومي غير متاح أو الكمية غير كافية';
      END IF;

      -- Custom specials have no backing meal. Never persist the client-side
      -- cart placeholder id as a meals foreign key.
      v_meal_id := v_special_row.meal_id;
      v_unit_price := v_special_row.price;
      v_meal_name := v_special_row.title;
      v_meal_image := v_special_row.image_url;
      v_variant_name := NULL;

      UPDATE public.available_today
      SET quantity = quantity - v_qty, updated_at = now()
      WHERE id = v_special_id;

    ELSIF v_variant_id IS NOT NULL THEN
      SELECT mv.*, m.name AS base_name, coalesce(mv.image_url, m.image_url) AS resolved_image
      INTO v_variant_row
      FROM public.meal_variants mv
      JOIN public.meals m ON m.id = mv.meal_id
      WHERE mv.id = v_variant_id AND mv.meal_id = v_meal_id
      FOR UPDATE OF mv;

      IF NOT found OR coalesce(v_variant_row.is_deleted, false)
         OR NOT v_variant_row.is_available THEN
        RAISE EXCEPTION 'الخيار المحدد غير متاح';
      END IF;
      IF v_variant_row.track_stock AND v_variant_row.stock_count IS NOT NULL
         AND v_variant_row.stock_count < v_qty THEN
        RAISE EXCEPTION 'كمية الخيار المحدد غير كافية';
      END IF;

      FOR v_extra_item IN SELECT value FROM jsonb_array_elements(v_extras) LOOP
        v_extra_id := nullif(v_extra_item->>'id', '')::uuid;
        SELECT id, name, price INTO v_extra_row
        FROM public.meal_variant_extras
        WHERE id = v_extra_id AND variant_id = v_variant_id AND is_available = true;
        IF NOT found THEN
          RAISE EXCEPTION 'إضافة غير صالحة أو غير متاحة';
        END IF;
        v_extras_cost := v_extras_cost + v_extra_row.price;
        v_verified_extras := v_verified_extras || jsonb_build_array(jsonb_build_object(
          'id', v_extra_row.id, 'name', v_extra_row.name, 'price', v_extra_row.price
        ));
      END LOOP;

      IF v_variant_row.track_stock AND v_variant_row.stock_count IS NOT NULL THEN
        UPDATE public.meal_variants
        SET stock_count = stock_count - v_qty, updated_at = now()
        WHERE id = v_variant_id;
      END IF;

      v_unit_price := v_variant_row.price + v_extras_cost;
      v_meal_name := v_variant_row.base_name || ' - ' || v_variant_row.name;
      v_meal_image := v_variant_row.resolved_image;
      v_variant_name := v_variant_row.name;

    ELSE
      IF jsonb_array_length(v_extras) > 0 THEN
        RAISE EXCEPTION 'لا يمكن إضافة إضافات بدون اختيار صالح';
      END IF;

      SELECT * INTO v_meal_row FROM public.meals WHERE id = v_meal_id;
      IF NOT found OR coalesce(v_meal_row.is_deleted, false) OR NOT v_meal_row.is_available THEN
        RAISE EXCEPTION 'الصنف غير موجود أو غير متاح';
      END IF;
      v_unit_price := v_meal_row.price;
      v_meal_name := v_meal_row.name;
      v_meal_image := v_meal_row.image_url;
      v_variant_name := NULL;
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'meal_id', v_meal_id,
      'today_special_id', v_special_id,
      'variant_id', v_variant_id,
      'variant_name', v_variant_name,
      'selected_extras', v_verified_extras,
      'quantity', v_qty,
      'unit_price', v_unit_price,
      'total_price', v_unit_price * v_qty,
      'customer_notes', v_item_notes,
      'meal_name', v_meal_name,
      'meal_image', v_meal_image
    ));
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'ORD-' || to_char(nextval('public.order_number_seq'), 'FM00000000');

  INSERT INTO public.orders (
    customer_id, order_number, subtotal, delivery_fee, discount, tax, total,
    status, payment_method, payment_status, notes, estimated_delivery,
    is_scheduled, scheduled_for, delivery_name, delivery_phone, delivery_email,
    delivery_address, delivery_city, delivery_area
  ) VALUES (
    v_customer_id, v_order_number, v_subtotal, v_delivery_fee, 0, 0, v_total,
    'pending_admin', v_payment_method, 'pending', v_notes, v_effective_sched,
    v_is_scheduled, v_effective_sched, v_delivery_name, v_delivery_phone,
    v_delivery_email, v_delivery_address, v_delivery_city, v_delivery_area
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, meal_id, today_special_id, variant_id, variant_name,
    selected_extras, quantity, unit_price, total_price, customer_notes,
    meal_name, meal_image
  )
  SELECT v_order_id,
    nullif(value->>'meal_id', '')::uuid,
    nullif(value->>'today_special_id', '')::uuid,
    nullif(value->>'variant_id', '')::uuid,
    value->>'variant_name', value->'selected_extras',
    (value->>'quantity')::integer, (value->>'unit_price')::numeric,
    (value->>'total_price')::numeric, value->>'customer_notes',
    value->>'meal_name', value->>'meal_image'
  FROM jsonb_array_elements(v_order_items);

  INSERT INTO public.order_timeline (order_id, status, created_by, notes)
  VALUES (v_order_id, 'pending_admin', v_customer_id::text,
    CASE WHEN v_is_scheduled THEN 'تم إنشاء الطلب (مجدول)' ELSE 'تم إنشاء الطلب' END);

  INSERT INTO public.notifications (user_id, title, body, type, is_read, data)
  VALUES (v_customer_id, 'تم استلام طلبك ✓',
    'طلبك #' || v_order_number || ' قيد المراجعة.', 'order_received', false,
    jsonb_build_object('order_id', v_order_id));

  INSERT INTO public.notifications (user_id, title, body, type, is_read, data)
  SELECT id, CASE WHEN v_is_scheduled THEN 'طلب مجدول جديد 📅' ELSE 'طلب جديد 📦' END,
    'تم إنشاء الطلب #' || v_order_number || ' بقيمة ' || v_total || ' جنيه.',
    'order_received', false, jsonb_build_object('order_id', v_order_id)
  FROM public.profiles WHERE role = 'admin' AND status = 'active';

  RETURN jsonb_build_object(
    'orderId', v_order_id, 'orderNumber', v_order_number,
    'subtotal', v_subtotal, 'deliveryFee', v_delivery_fee,
    'total', v_total, 'isScheduled', v_is_scheduled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order_atomic_v2(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order_atomic_v2(jsonb) TO authenticated;

-- Enforce legal forward transitions regardless of which UI performs the update.
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status = 'pending_admin' AND NEW.status IN ('dispatching','waiting_cook','accepted','cancelled')) OR
    (OLD.status = 'dispatching' AND NEW.status IN ('waiting_cook','accepted','cancelled')) OR
    (OLD.status = 'waiting_cook' AND NEW.status IN ('dispatching','accepted','cancelled')) OR
    (OLD.status = 'accepted' AND NEW.status IN ('preparing','cancelled')) OR
    (OLD.status = 'preparing' AND NEW.status IN ('ready','cancelled')) OR
    (OLD.status = 'ready' AND NEW.status IN ('out_for_delivery','delivered','cancelled')) OR
    (OLD.status = 'out_for_delivery' AND NEW.status IN ('delivered','cancelled'))
  ) THEN
    RAISE EXCEPTION 'انتقال غير مسموح من % إلى %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status_transition ON public.orders;
CREATE TRIGGER trg_enforce_order_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_status_transition();

CREATE OR REPLACE FUNCTION public.log_and_notify_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_type text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  INSERT INTO public.order_timeline (order_id, status, created_by, notes)
  VALUES (NEW.id, NEW.status, coalesce(auth.uid()::text, 'system'),
    'تم تغيير الحالة إلى ' || NEW.status);

  SELECT title, body, notif_type INTO v_title, v_body, v_type
  FROM (VALUES
    ('accepted', '✅ تم قبول طلبك', 'طلبك تم قبوله وسيبدأ التحضير قريباً', 'order_accepted'),
    ('preparing', '👨‍🍳 جاري التحضير', 'الطاهي بدأ في تحضير طلبك', 'order_preparing'),
    ('ready', '🎉 طلبك جاهز', 'طلبك جاهز وسيتم تسليمه للمندوب', 'order_ready'),
    ('out_for_delivery', '🚗 المندوب في الطريق', 'طلبك في الطريق إليك!', 'order_out_for_delivery'),
    ('delivered', '🏠 تم التوصيل', 'تم توصيل طلبك. شكراً لثقتك بـ sofra!', 'order_delivered'),
    ('cancelled', '❌ تم إلغاء الطلب', 'نعتذر، تم إلغاء طلبك.', 'order_cancelled')
  ) AS n(status, title, body, notif_type)
  WHERE status = NEW.status;

  IF v_type IS NOT NULL AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read, data)
    VALUES (NEW.customer_id, v_title, v_body, v_type, false,
      jsonb_build_object('order_id', NEW.id, 'type', v_type));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_and_notify_order_status ON public.orders;
CREATE TRIGGER trg_log_and_notify_order_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_and_notify_order_status();

-- Replace direct chat pushes with a notification row; the single generic
-- notifications trigger is responsible for push delivery.
CREATE OR REPLACE FUNCTION public.enqueue_admin_chat_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer_id uuid;
BEGIN
  IF NEW.sender_type <> 'admin' THEN RETURN NEW; END IF;
  SELECT customer_id INTO v_customer_id FROM public.chat_threads WHERE id = NEW.thread_id;
  IF v_customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read, data)
    VALUES (v_customer_id, '💬 رد جديد من sofra', left(NEW.message, 100),
      'chat_reply', false, jsonb_build_object('thread_id', NEW.thread_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_admin_chat_reply ON public.chat_messages;
CREATE TRIGGER trg_enqueue_admin_chat_reply
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_admin_chat_reply();

-- Remove overlapping legacy push paths. Keep only:
-- DB event -> notifications row -> trg_dispatch_push_on_notification -> Edge.
DROP TRIGGER IF EXISTS trg_order_status_push ON public.orders;
DROP TRIGGER IF EXISTS trg_new_order_admin_push ON public.orders;
DROP TRIGGER IF EXISTS trg_admin_chat_reply_push ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_new_special_notification ON public.available_today;
DROP TRIGGER IF EXISTS trg_new_special_push ON public.available_today;

-- Soft-deleted reviews must never leak to public/customer review feeds.
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT USING (
    public.is_admin()
    OR (deleted_at IS NULL AND (status = 'approved' OR auth.uid() = customer_id))
  );
