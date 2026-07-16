-- ============================================================
-- 0008_admin_unread_triggers.sql
-- Phase 7: Automated unread count triggers for admin_read_state
-- ============================================================

-- ── 1. Orders Increment Trigger ─────────────────────────────
create or replace function public.increment_admin_orders_unread()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.admin_read_state (admin_id, section, unread_count)
  select id, 'orders', 1
    from public.profiles
   where role = 'admin'
  on conflict (admin_id, section) do update
   set unread_count = public.admin_read_state.unread_count + 1;
  return new;
end;
$$;

drop trigger if exists trg_increment_admin_orders on public.orders;
create trigger trg_increment_admin_orders
  after insert on public.orders
  for each row execute function public.increment_admin_orders_unread();

-- ── 2. Chat Increment Trigger ───────────────────────────────
create or replace function public.increment_admin_chat_unread()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.sender_type = 'customer' then
    insert into public.admin_read_state (admin_id, section, unread_count)
    select id, 'chat', 1
      from public.profiles
     where role = 'admin'
    on conflict (admin_id, section) do update
     set unread_count = public.admin_read_state.unread_count + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_increment_admin_chat on public.chat_messages;
create trigger trg_increment_admin_chat
  after insert on public.chat_messages
  for each row execute function public.increment_admin_chat_unread();

-- ── 3. Users Increment Trigger ──────────────────────────────
create or replace function public.increment_admin_users_unread()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.admin_read_state (admin_id, section, unread_count)
  select id, 'users', 1
    from public.profiles
   where role = 'admin'
     and id <> new.id
  on conflict (admin_id, section) do update
   set unread_count = public.admin_read_state.unread_count + 1;
  return new;
end;
$$;

drop trigger if exists trg_increment_admin_users on public.profiles;
create trigger trg_increment_admin_users
  after insert on public.profiles
  for each row execute function public.increment_admin_users_unread();
