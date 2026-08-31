-- ============================================================
-- 0019_notifications_complete_fix.sql
-- End-to-End Push Notifications Architecture Fixes
-- ============================================================

-- 1. Ensure notifications table has all necessary columns
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- 2. Ensure device_tokens table and permissions
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL DEFAULT 'android',
  last_used  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_all_policy" ON public.device_tokens;
CREATE POLICY "device_tokens_all_policy" ON public.device_tokens
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Create push_tokens view alias for backward compatibility (safely drop table or view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_tokens' AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE 'DROP TABLE public.push_tokens CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_tokens' AND table_type = 'VIEW'
  ) THEN
    EXECUTE 'DROP VIEW public.push_tokens CASCADE';
  END IF;
END $$;

CREATE VIEW public.push_tokens AS
  SELECT id, user_id, token, platform, last_used, created_at
  FROM public.device_tokens;

-- 3. Trigger: Automatically notify all customers when a new Today Special is published
CREATE OR REPLACE FUNCTION public.notify_today_special_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire notification when new row inserted as active or updated to active
  IF (TG_OP = 'INSERT' AND NEW.is_active = true) OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL)) THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read, data)
    SELECT
      p.id,
      '⚡ عرض جديد في عروض اليوم!',
      'طبق جديد متاح الآن: ' || NEW.title || ' بسعر ' || NEW.price::text || ' جنيه',
      'today_special',
      false,
      jsonb_build_object('today_special_id', NEW.id, 'screen', '/(tabs)/menu')
    FROM public.profiles p
    WHERE p.role = 'customer'
      AND p.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_today_special_published ON public.available_today;
CREATE TRIGGER trg_today_special_published
  AFTER INSERT OR UPDATE ON public.available_today
  FOR EACH ROW EXECUTE FUNCTION public.notify_today_special_published();

-- 4. Trigger: Dispatch Push Notification via pg_net whenever a notification row is created
CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_function_url text := current_setting('app.settings.push_function_url', true);
  v_service_key  text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_function_url IS NOT NULL AND v_function_url <> '' THEN
    PERFORM net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_service_key, '')
      ),
      body    := jsonb_build_object(
        'user_ids', jsonb_build_array(NEW.user_id),
        'title', NEW.title,
        'body', NEW.body,
        'notification_type', NEW.type,
        'data', coalesce(NEW.data, '{}'::jsonb)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_push_on_notification ON public.notifications;
CREATE TRIGGER trg_dispatch_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_on_notification_insert();
