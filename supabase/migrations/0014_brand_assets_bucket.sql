-- ============================================================
-- 0014_brand_assets_bucket.sql
-- Storage bucket for brand assets (logo, hero image, banners)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public Access Brand Assets" on storage.objects;
create policy "Public Access Brand Assets" on storage.objects
  for select using (bucket_id = 'brand-assets');

drop policy if exists "Admin Upload Brand Assets" on storage.objects;
create policy "Admin Upload Brand Assets" on storage.objects
  for insert with check (bucket_id = 'brand-assets' and public.is_admin());

drop policy if exists "Admin Update Brand Assets" on storage.objects;
create policy "Admin Update Brand Assets" on storage.objects
  for update using (bucket_id = 'brand-assets' and public.is_admin());

drop policy if exists "Admin Delete Brand Assets" on storage.objects;
create policy "Admin Delete Brand Assets" on storage.objects
  for delete using (bucket_id = 'brand-assets' and public.is_admin());
