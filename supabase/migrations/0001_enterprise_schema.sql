-- ============================================================
-- SOFRA ENTERPRISE — Master Database Migration
-- Version: 1.0 — Based on 05_DATABASE_DESIGN.md
-- Rule 7: Every database modification must be a migration
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pg_net" with schema extensions;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  phone       text unique,
  full_name   text,
  avatar_url  text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  status      text not null default 'active' check (status in ('active', 'blocked', 'deleted')),
  last_login  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(status);

-- ============================================================
-- CUSTOMER ADDRESSES
-- ============================================================
create table if not exists public.customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  city        text not null,
  area        text not null,
  street      text not null,
  building    text,
  floor       text,
  apartment   text,
  landmark    text,
  latitude    numeric(10, 7),
  longitude   numeric(10, 7),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists addresses_customer_idx on public.customer_addresses(customer_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- SUBCATEGORIES
-- ============================================================
create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists subcategories_category_idx on public.subcategories(category_id);

-- ============================================================
-- MEALS
-- ============================================================
create table if not exists public.meals (
  id                        uuid primary key default gen_random_uuid(),
  subcategory_id            uuid not null references public.subcategories(id) on delete restrict,
  name                      text not null,
  description               text,
  price                     numeric(10, 2) not null check (price >= 0),
  estimated_preparation_time integer,
  image_url                 text,
  gallery                   text[],
  rating                    numeric(3, 2) not null default 0 check (rating between 0 and 5),
  reviews_count             integer not null default 0,
  is_available              boolean not null default true,
  is_featured               boolean not null default false,
  is_popular                boolean not null default false,
  calories                  integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists meals_subcategory_idx on public.meals(subcategory_id);
create index if not exists meals_available_idx on public.meals(is_available);
create index if not exists meals_featured_idx on public.meals(is_featured);
create index if not exists meals_popular_idx on public.meals(is_popular);
create index if not exists meals_name_idx on public.meals using gin(to_tsvector('arabic', name));

-- ============================================================
-- COOKS
-- ============================================================
create table if not exists public.cooks (
  id                        uuid primary key default gen_random_uuid(),
  full_name                 text not null,
  phone                     text not null unique,
  whatsapp                  text not null,
  city                      text,
  address                   text,
  latitude                  numeric(10, 7),
  longitude                 numeric(10, 7),
  specialties               text[],
  priority                  integer not null default 5 check (priority between 1 and 10),
  status                    text not null default 'available' check (status in ('available', 'busy', 'unavailable', 'vacation')),
  rating                    numeric(3, 2) not null default 0,
  acceptance_rate           numeric(5, 2) not null default 100,
  completed_orders          integer not null default 0,
  average_preparation_time  integer,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists cooks_status_idx on public.cooks(status);

-- ============================================================
-- COOK AVAILABILITY
-- ============================================================
create table if not exists public.cook_availability (
  id           uuid primary key default gen_random_uuid(),
  cook_id      uuid not null references public.cooks(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  is_available boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cook_availability_cook_idx on public.cook_availability(cook_id);

-- ============================================================
-- ORDERS
-- ============================================================
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid references public.profiles(id) on delete set null,
  address_id       uuid references public.customer_addresses(id) on delete set null,
  cook_id          uuid references public.cooks(id) on delete set null,
  order_number     text not null unique,
  subtotal         numeric(10, 2) not null default 0,
  delivery_fee     numeric(10, 2) not null default 0,
  discount         numeric(10, 2) not null default 0,
  tax              numeric(10, 2) not null default 0,
  total            numeric(10, 2) not null default 0,
  status           text not null default 'pending_admin' check (status in ('pending_admin','dispatching','waiting_cook','accepted','preparing','ready','out_for_delivery','delivered','cancelled')),
  payment_method   text not null default 'cash' check (payment_method in ('cash','card','wallet')),
  payment_status   text not null default 'pending' check (payment_status in ('pending','paid','refunded','failed')),
  notes            text,
  estimated_delivery timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_cook_idx on public.orders(cook_id);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  meal_id        uuid not null references public.meals(id) on delete restrict,
  quantity       integer not null check (quantity > 0),
  unit_price     numeric(10, 2) not null,
  total_price    numeric(10, 2) not null,
  customer_notes text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ============================================================
-- ORDER TIMELINE
-- ============================================================
create table if not exists public.order_timeline (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     text not null,
  created_by text,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists order_timeline_order_idx on public.order_timeline(order_id);

-- ============================================================
-- DISPATCH HISTORY
-- ============================================================
create table if not exists public.dispatch_history (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  cook_id        uuid not null references public.cooks(id) on delete cascade,
  attempt_number integer not null default 1,
  status         text not null default 'sent' check (status in ('sent','accepted','rejected','no_response')),
  response       text,
  sent_at        timestamptz not null default now(),
  responded_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists dispatch_order_idx on public.dispatch_history(order_id);

-- ============================================================
-- REVIEWS
-- ============================================================
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  meal_id     uuid not null references public.meals(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  status      text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(order_id, meal_id)
);
create index if not exists reviews_meal_idx on public.reviews(meal_id);
create index if not exists reviews_customer_idx on public.reviews(customer_id);

-- ============================================================
-- COMPLAINTS
-- ============================================================
create table if not exists public.complaints (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text not null,
  status      text not null default 'open' check (status in ('open','investigating','resolved','closed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists complaints_customer_idx on public.complaints(customer_id);
create index if not exists complaints_status_idx on public.complaints(status);

-- ============================================================
-- CHAT THREADS
-- ============================================================
create table if not exists public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  unread_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(customer_id)
);
create index if not exists chat_threads_customer_idx on public.chat_threads(customer_id);
create index if not exists chat_threads_last_msg_idx on public.chat_threads(last_message_at desc nulls last);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
create table if not exists public.chat_messages (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references public.chat_threads(id) on delete cascade,
  sender_type    text not null check (sender_type in ('customer','admin')),
  message        text not null,
  attachment_url text,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages(thread_id);
create index if not exists chat_messages_created_idx on public.chat_messages(created_at);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  type       text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_unread_idx on public.notifications(user_id, is_read) where is_read = false;

-- ============================================================
-- DEVICE TOKENS (Push Notifications)
-- ============================================================
create table if not exists public.device_tokens (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  token     text not null unique,
  platform  text not null check (platform in ('ios','android','web')),
  last_used timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

-- ============================================================
-- APP SETTINGS
-- ============================================================
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb,
  description text,
  updated_at  timestamptz not null default now()
);

-- Default settings
insert into public.app_settings (key, value, description) values
  ('delivery_fee',         '25',          'رسوم التوصيل الافتراضية (جنيه)'),
  ('min_order_amount',     '0',           'الحد الأدنى للطلب'),
  ('whatsapp_number',      '"+201000000000"', 'رقم واتساب خدمة العملاء'),
  ('business_phone',       '"+201000000000"', 'رقم هاتف العمل'),
  ('business_address',     '"القاهرة، مصر"', 'عنوان العمل'),
  ('delivery_time_estimate','30-60 دقيقة"', 'وقت التوصيل المتوقع'),
  ('maintenance_mode',     'false',       'وضع الصيانة'),
  ('privacy_policy_url',   '"https://example.com/privacy"', 'رابط سياسة الخصوصية'),
  ('terms_url',            '"https://example.com/terms"', 'رابط الشروط والأحكام')
on conflict (key) do nothing;

-- ============================================================
-- CUSTOMER NOTES (CRM)
-- ============================================================
create table if not exists public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  admin_id    uuid references public.profiles(id) on delete set null,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists customer_notes_customer_idx on public.customer_notes(customer_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  old_value  jsonb,
  new_value  jsonb,
  ip_address text,
  device     text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_admin_idx on public.audit_logs(admin_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ============================================================
-- COUPONS
-- ============================================================
create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  discount_type  text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  min_order      numeric(10, 2) not null default 0,
  max_uses       integer,
  used_count     integer not null default 0,
  start_date     timestamptz,
  end_date       timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- AUTO-UPDATE updated_at via trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  for tbl in select unnest(array['profiles','customer_addresses','categories','subcategories','meals','cooks','cook_availability','orders','order_items','reviews','complaints','chat_threads','coupons']) loop
    execute format('drop trigger if exists set_updated_at on public.%I', tbl);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.handle_updated_at()', tbl);
  end loop;
end $$;

-- ============================================================
-- CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'customer'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
