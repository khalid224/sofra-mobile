-- ============================================================
-- SOFRA ENTERPRISE — Migration 005
-- Analytics materialized views for fast dashboard loading
-- Per 10_ANALYTICS_AND_REPORTING.md: "Dashboard Load < 2 seconds"
-- ============================================================

-- ─── Daily Revenue Summary View ──────────────────────────────
create materialized view if not exists public.mv_daily_revenue as
select
  date_trunc('day', created_at) as day,
  count(*) as total_orders,
  count(*) filter (where status = 'delivered') as delivered_orders,
  count(*) filter (where status = 'cancelled') as cancelled_orders,
  coalesce(sum(total) filter (where status = 'delivered'), 0) as revenue,
  coalesce(avg(total) filter (where status = 'delivered'), 0) as avg_order_value
from public.orders
group by date_trunc('day', created_at)
order by day desc;

create unique index if not exists mv_daily_revenue_day_idx on public.mv_daily_revenue(day);

-- ─── Top Meals View ──────────────────────────────────────────
create materialized view if not exists public.mv_top_meals as
select
  oi.meal_id,
  m.name as meal_name,
  m.price,
  sum(oi.quantity) as total_ordered,
  count(distinct oi.order_id) as order_count,
  sum(oi.total_price) as total_revenue
from public.order_items oi
join public.meals m on m.id = oi.meal_id
join public.orders o on o.id = oi.order_id
where o.status = 'delivered'
group by oi.meal_id, m.name, m.price
order by total_ordered desc;

create unique index if not exists mv_top_meals_meal_idx on public.mv_top_meals(meal_id);

-- ─── Cook Performance View ───────────────────────────────────
create materialized view if not exists public.mv_cook_performance as
select
  c.id as cook_id,
  c.full_name,
  c.rating,
  c.acceptance_rate,
  c.completed_orders,
  count(o.id) filter (where o.status = 'delivered') as delivered_this_month,
  count(o.id) filter (where o.status = 'cancelled') as cancelled_this_month,
  coalesce(sum(o.total) filter (where o.status = 'delivered'), 0) as revenue_this_month
from public.cooks c
left join public.orders o on o.cook_id = c.id and o.created_at >= date_trunc('month', now())
group by c.id, c.full_name, c.rating, c.acceptance_rate, c.completed_orders;

create unique index if not exists mv_cook_perf_cook_idx on public.mv_cook_performance(cook_id);

-- ─── Refresh function for materialized views ─────────────────
-- Call periodically or after bulk updates.
create or replace function public.refresh_analytics_views()
returns void language plpgsql security definer as $$
begin
  refresh materialized view concurrently public.mv_daily_revenue;
  refresh materialized view concurrently public.mv_top_meals;
  refresh materialized view concurrently public.mv_cook_performance;
end;
$$;

-- RLS: admin only on views (views inherit table RLS but we add explicit security)
-- Note: materialized views don't support RLS directly; secure via function/edge function

-- ─── Grant access to analytics function ──────────────────────
grant execute on function public.refresh_analytics_views() to authenticated;

-- ─── Index on orders.created_at for fast date filtering ──────
create index if not exists orders_created_at_status_idx on public.orders(created_at, status);

-- ─── Index on order_items for analytics queries ──────────────
create index if not exists order_items_analytics_idx on public.order_items(meal_id, order_id);

-- ─── SETUP NOTES ─────────────────────────────────────────────
-- To schedule view refresh via pg_cron (Supabase Pro):
--   select cron.schedule('refresh-analytics', '0 */6 * * *',
--     'select public.refresh_analytics_views()');
--
-- To deploy analytics-dashboard edge function:
--   supabase functions deploy analytics-dashboard
--
-- To deploy daily-report edge function:
--   supabase functions deploy daily-report
