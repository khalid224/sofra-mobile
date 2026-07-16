-- ============================================================
-- SOFRA ENTERPRISE — Push Notification Triggers
-- Uses pg_net to call send-push-notification edge function
-- ============================================================

-- Set these via: ALTER DATABASE postgres SET app.settings.xxx = '...'
-- Or use Supabase Vault for secrets.

-- Trigger: notify customer when order status changes
create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := current_setting('app.settings.push_function_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
  v_notif        jsonb;
begin
  if new.status = old.status then return new; end if;
  if new.customer_id is null then return new; end if;
  if v_function_url is null or v_function_url = '' then return new; end if;

  v_notif := case new.status
    when 'accepted'        then '{"title":"✅ تم قبول طلبك","body":"طلبك تم قبوله وسيبدأ التحضير قريباً","type":"order_accepted"}'::jsonb
    when 'preparing'       then '{"title":"👨‍🍳 جاري التحضير","body":"الطاهي بدأ في تحضير طلبك الآن","type":"order_preparing"}'::jsonb
    when 'ready'           then '{"title":"🎉 طلبك جاهز","body":"طلبك جاهز وفي طريقه إليك","type":"order_ready"}'::jsonb
    when 'out_for_delivery' then '{"title":"🚗 المندوب في الطريق","body":"طلبك في الطريق إليك، استعد للاستلام!","type":"order_out_for_delivery"}'::jsonb
    when 'delivered'       then '{"title":"🏠 تم التوصيل","body":"تم توصيل طلبك بنجاح. شكراً لثقتك بـ sofra!","type":"order_delivered"}'::jsonb
    when 'cancelled'       then '{"title":"❌ تم الإلغاء","body":"نعتذر، تم إلغاء طلبك. تواصل معنا لمزيد من التفاصيل.","type":"order_cancelled"}'::jsonb
    else null
  end;

  if v_notif is not null then
    perform net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_service_key),
      body    := jsonb_build_object(
        'user_ids', jsonb_build_array(new.customer_id),
        'title', v_notif->>'title',
        'body',  v_notif->>'body',
        'notification_type', v_notif->>'type',
        'data', jsonb_build_object('order_id', new.id, 'type', v_notif->>'type')
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_status_push on public.orders;
create trigger trg_order_status_push
  after update of status on public.orders
  for each row execute function public.notify_order_status_change();


-- Trigger: notify customer when admin replies in chat
create or replace function public.notify_admin_chat_reply()
returns trigger language plpgsql security definer as $$
declare
  v_function_url  text := current_setting('app.settings.push_function_url', true);
  v_service_key   text := current_setting('app.settings.service_role_key', true);
  v_customer_id   uuid;
begin
  if new.sender_type != 'admin' then return new; end if;
  if v_function_url is null or v_function_url = '' then return new; end if;

  select customer_id into v_customer_id from public.chat_threads where id = new.thread_id;
  if v_customer_id is null then return new; end if;

  perform net.http_post(
    url     := v_function_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_service_key),
    body    := jsonb_build_object(
      'user_ids', jsonb_build_array(v_customer_id),
      'title', '💬 رد جديد من sofra',
      'body',  left(new.message, 100),
      'notification_type', 'chat_reply',
      'data', jsonb_build_object('thread_id', new.thread_id, 'type', 'chat_reply')
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_admin_chat_reply_push on public.chat_messages;
create trigger trg_admin_chat_reply_push
  after insert on public.chat_messages
  for each row execute function public.notify_admin_chat_reply();


-- Trigger: notify all admins when new order is placed
create or replace function public.notify_admins_new_order()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := current_setting('app.settings.push_function_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
  v_admin_ids    jsonb;
begin
  if v_function_url is null or v_function_url = '' then return new; end if;

  select jsonb_agg(id) into v_admin_ids
  from public.profiles where role = 'admin' and status = 'active';

  if v_admin_ids is not null and jsonb_array_length(v_admin_ids) > 0 then
    perform net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_service_key),
      body    := jsonb_build_object(
        'user_ids', v_admin_ids,
        'title', '🆕 طلب جديد',
        'body',  'وصل طلب جديد #' || new.order_number || ' — ' || new.total::text || ' جنيه',
        'notification_type', 'new_order',
        'data', jsonb_build_object('order_id', new.id, 'type', 'new_order')
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_new_order_admin_push on public.orders;
create trigger trg_new_order_admin_push
  after insert on public.orders
  for each row execute function public.notify_admins_new_order();


-- ============================================================
-- HOW TO CONFIGURE TRIGGERS:
-- Run once after migration:
--   ALTER DATABASE postgres SET app.settings.push_function_url =
--     'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
--
-- Or use Supabase Vault (recommended for production):
--   INSERT INTO vault.secrets (name, secret) VALUES
--     ('push_function_url', 'https://...'),
--     ('service_role_key', 'sk_...');
--   Then use: select decrypted_secret from vault.decrypted_secrets where name = '...'
-- ============================================================
