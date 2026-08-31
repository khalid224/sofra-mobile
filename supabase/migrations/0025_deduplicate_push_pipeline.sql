-- Keep one push pipeline only:
-- domain event -> notifications row -> trg_dispatch_push_on_notification -> Edge Function.
-- The direct pg_net triggers below overlap with that pipeline and can send
-- duplicate notifications. The historical functions remain for auditability.

drop trigger if exists trg_order_status_push on public.orders;
drop trigger if exists trg_new_order_admin_push on public.orders;
drop trigger if exists trg_admin_chat_reply_push on public.chat_messages;
drop trigger if exists trg_new_special_notification on public.available_today;
drop trigger if exists trg_new_special_push on public.available_today;
