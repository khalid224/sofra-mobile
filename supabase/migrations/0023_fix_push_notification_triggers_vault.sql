-- ============================================================
-- SOFRA ENTERPRISE — Fix push-notification triggers
-- ALTER DATABASE ... SET app.settings.xxx is not permitted on
-- hosted Supabase (permission denied: 42501). Switch to Supabase
-- Vault for the service_role_key, and hardcode the (non-secret)
-- function URL directly.
--
-- BEFORE RUNNING THIS FILE: store the secret once via SQL Editor:
--   select vault.create_secret(
--     '<YOUR_SERVICE_ROLE_KEY>',
--     'service_role_key',
--     'Service role key used by push-notification triggers'
--   );
-- ============================================================

-- Order status change
create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := 'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_service_key  text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  v_notif        jsonb;
begin
  if new.status = old.status then return new; end if;
  if new.customer_id is null then return new; end if;
  if v_service_key is null then return new; end if;

  v_notif := case new.status
    when 'accepted'         then '{"title":"✅ تم قبول طلبك","body":"طلبك تم قبوله وسيبدأ التحضير قريباً","type":"order_accepted"}'::jsonb
    when 'preparing'        then '{"title":"👨‍🍳 جاري التحضير","body":"الطاهي بدأ في تحضير طلبك الآن","type":"order_preparing"}'::jsonb
    when 'ready'            then '{"title":"🎉 طلبك جاهز","body":"طلبك جاهز وفي طريقه إليك","type":"order_ready"}'::jsonb
    when 'out_for_delivery' then '{"title":"🚗 المندوب في الطريق","body":"طلبك في الطريق إليك، استعد للاستلام!","type":"order_out_for_delivery"}'::jsonb
    when 'delivered'        then '{"title":"🏠 تم التوصيل","body":"تم توصيل طلبك بنجاح. شكراً لثقتك بـ sofra!","type":"order_delivered"}'::jsonb
    when 'cancelled'        then '{"title":"❌ تم الإلغاء","body":"نعتذر، تم إلغاء طلبك. تواصل معنا لمزيد من التفاصيل.","type":"order_cancelled"}'::jsonb
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

-- Admin chat reply
create or replace function public.notify_admin_chat_reply()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := 'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_service_key  text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  v_customer_id  uuid;
begin
  if new.sender_type != 'admin' then return new; end if;
  if v_service_key is null then return new; end if;

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

-- New order -> notify admins
create or replace function public.notify_admins_new_order()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := 'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_service_key  text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  v_admin_ids    jsonb;
begin
  if v_service_key is null then return new; end if;

  select jsonb_agg(id) into v_admin_ids
  from public.profiles where role = 'admin' and status = 'active';

  if v_admin_ids is not null and jsonb_array_length(v_admin_ids) > 0 then
    perform net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_service_key),
      body    := jsonb_build_object(
        'user_ids', v_admin_ids,
        'title', '🆕 طلب جديد',
        'body',  'وصل طلب جديد يحتاج مراجعتك',
        'notification_type', 'new_order',
        'data', jsonb_build_object('order_id', new.id, 'type', 'new_order')
      )
    );
  end if;
  return new;
end;
$$;

-- New "available today" special -> notify customers
create or replace function public.notify_customers_new_special()
returns trigger language plpgsql security definer as $$
declare
  v_function_url text := 'https://axdqbmdcymvmowrlvqnv.supabase.co/functions/v1/send-push-notification';
  v_service_key  text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  v_customer_ids jsonb;
begin
  if new.is_active is not true then return new; end if;
  if v_service_key is null then return new; end if;

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
