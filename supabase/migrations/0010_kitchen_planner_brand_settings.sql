-- ============================================================
-- 0010_kitchen_planner_brand_settings.sql
-- Kitchen Planner & Brand Settings Migration
-- ============================================================

-- ── 1. brand_settings table ──────────────────────────────────
create table if not exists public.brand_settings (
  key         text primary key,
  value       text,
  label       text,
  type        text default 'text',
  updated_at  timestamptz default now()
);

insert into public.brand_settings (key, value, label, type) values
  ('primary_color',    '#C1694A', 'اللون الرئيسي (Terracotta)',  'color'),
  ('secondary_color',  '#71794C', 'اللون الثانوي (Olive)',        'color'),
  ('background_color', '#F6EFE3', 'لون الخلفية (Cream)',          'color'),
  ('text_color',       '#4A342A', 'لون النص (Deep Brown)',        'color'),
  ('home_title',       'sofra 🍽️', 'عنوان الصفحة الرئيسية',      'text'),
  ('home_subtitle',    'أكل بيتي مصري أصيل، محضّر بحب',        'text'),
  ('logo_url',         '',        'شعار المنصة',                'url'),
  ('hero_image_url',   '',        'صورة الهيرو',                'url'),
  ('font_family',      'Tajawal', 'خط النظام',                   'font')
on conflict (key) do nothing;

-- ── 2. Add kitchen planner columns to orders ─────────────────
alter table public.orders
  add column if not exists assigned_cook_id uuid references public.cooks(id) on delete set null,
  add column if not exists kitchen_notes text,
  add column if not exists prep_status text not null default 'waiting',
  add column if not exists prep_start_at timestamptz,
  add column if not exists prep_finish_at timestamptz,
  add column if not exists kitchen_priority integer not null default 0;

-- ── 3. RLS for brand_settings ────────────────────────────────
alter table public.brand_settings enable row level security;

drop policy if exists "brand_settings public select" on public.brand_settings;
create policy "brand_settings public select"
  on public.brand_settings for select
  using (true);

drop policy if exists "brand_settings admin update" on public.brand_settings;
create policy "brand_settings admin update"
  on public.brand_settings for all
  using (
    auth.uid() in (
      select id from public.profiles where role = 'admin'
    )
  );
