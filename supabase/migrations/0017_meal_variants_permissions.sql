-- ============================================================
-- 0017_meal_variants_permissions.sql
-- Fix table GRANT permissions and RLS policies for meal_variants and meal_variant_extras
-- ============================================================

-- ── 1. Table-level GRANT permissions ──────────────────────────
grant select, insert, update, delete on table public.meal_variants to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on table public.meal_variant_extras to postgres, anon, authenticated, service_role;

-- ── 2. Update RLS Policies for meal_variants ───────────────────
alter table public.meal_variants enable row level security;

drop policy if exists "meal_variants_select" on public.meal_variants;
create policy "meal_variants_select" on public.meal_variants
  for select using (true);

drop policy if exists "meal_variants_admin" on public.meal_variants;
drop policy if exists "meal_variants_write" on public.meal_variants;

create policy "meal_variants_write" on public.meal_variants
  for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- ── 3. Update RLS Policies for meal_variant_extras ────────────
alter table public.meal_variant_extras enable row level security;

drop policy if exists "meal_variant_extras_select" on public.meal_variant_extras;
create policy "meal_variant_extras_select" on public.meal_variant_extras
  for select using (true);

drop policy if exists "meal_variant_extras_admin" on public.meal_variant_extras;
drop policy if exists "meal_variant_extras_write" on public.meal_variant_extras;

create policy "meal_variant_extras_write" on public.meal_variant_extras
  for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');
