-- ============================================================
-- 0032_public_approved_reviews.sql
-- Let guests read only approved, non-deleted testimonials.
-- Customer profiles remain private and are not exposed by the public query.
-- ============================================================

begin;

alter table public.reviews enable row level security;

drop policy if exists "reviews_public_approved_select" on public.reviews;
create policy "reviews_public_approved_select"
  on public.reviews for select to anon
  using (deleted_at is null and status = 'approved');

grant select on public.reviews to anon;

commit;
