-- ============================================================
-- SOFRA ENTERPRISE — Fix recurring "permission denied" errors
-- for service_role.
--
-- service_role is meant to bypass RLS AND have full table access
-- by default in Supabase, but this project's tables were created
-- without the schema-level default privileges being set, so each
-- new table silently lacks grants (already patched ad-hoc for
-- brand_settings, app_settings, meal_variants — same root cause).
--
-- This migration grants access on EVERY existing table, and sets
-- default privileges so any table created from now on is covered
-- automatically — no more one-off "0015_x_permissions.sql" style
-- patches needed per table.
-- ============================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
