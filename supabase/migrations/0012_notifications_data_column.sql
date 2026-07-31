-- ============================================================
-- 0012_notifications_data_column.sql
-- Add optional data JSONB payload column for deep-linking
-- ============================================================

alter table public.notifications
  add column if not exists data jsonb default null;

create index if not exists idx_notifications_type on public.notifications(type);
