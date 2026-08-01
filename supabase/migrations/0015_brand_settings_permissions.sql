-- ============================================================
-- 0015_brand_settings_permissions.sql
-- Fix table grants and RLS policies for brand_settings and app_settings
-- ============================================================

-- ── 1. Explicit GRANT permissions ─────────────────────────────
grant select, insert, update, delete on table public.brand_settings to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on table public.app_settings to postgres, anon, authenticated, service_role;

-- ── 2. Update RLS Policies for brand_settings ─────────────────
alter table public.brand_settings enable row level security;

drop policy if exists "brand_settings public select" on public.brand_settings;
create policy "brand_settings public select"
  on public.brand_settings for select
  using (true);

drop policy if exists "brand_settings admin update" on public.brand_settings;
drop policy if exists "brand_settings admin write" on public.brand_settings;

create policy "brand_settings admin write"
  on public.brand_settings for all
  using (
    public.is_admin() or auth.role() = 'service_role'
  )
  with check (
    public.is_admin() or auth.role() = 'service_role'
  );

-- ── 3. Update RLS Policies for app_settings ───────────────────
alter table public.app_settings enable row level security;

drop policy if exists "app_settings public select" on public.app_settings;
create policy "app_settings public select"
  on public.app_settings for select
  using (true);

drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write"
  on public.app_settings for all
  using (
    public.is_admin() or auth.role() = 'service_role'
  )
  with check (
    public.is_admin() or auth.role() = 'service_role'
  );
