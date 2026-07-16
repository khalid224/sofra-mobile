// supabase/functions/analytics-dashboard/index.ts
// Computes all dashboard KPIs in a single optimized call.
// Per 10_ANALYTICS_AND_REPORTING.md: Dashboard Load < 2 seconds.
// Admin only — validates JWT and role before computing.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authenticate admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('غير مصرح');
    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('غير مصرح');
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'admin') throw new Error('للمديرين فقط');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

    // Run all queries in parallel for speed
    const [
      todayOrders,
      monthOrders,
      pendingOrders,
      preparingOrders,
      deliveredToday,
      cancelledToday,
      openComplaints,
      unreadChats,
      activeCooks,
      newCustomersMonth,
      recentOrders,
      topMeals,
    ] = await Promise.all([
      // Today's orders + revenue
      admin.from('orders').select('id, total, status').gte('created_at', todayStart),
      // Month orders + revenue
      admin.from('orders').select('id, total, status').gte('created_at', monthStart),
      // Pending admin
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_admin'),
      // Preparing
      admin.from('orders').select('id', { count: 'exact', head: true }).in('status', ['accepted', 'preparing', 'ready']),
      // Delivered today
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('created_at', todayStart),
      // Cancelled today
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').gte('created_at', todayStart),
      // Open complaints
      admin.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      // Unread chat threads
      admin.from('chat_threads').select('id', { count: 'exact', head: true }).gt('unread_count', 0),
      // Available cooks
      admin.from('cooks').select('id', { count: 'exact', head: true }).eq('status', 'available'),
      // New customers this month
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer').gte('created_at', monthStart),
      // Recent orders (latest 10)
      admin.from('orders').select('id, order_number, total, status, created_at, customer_id').order('created_at', { ascending: false }).limit(10),
      // Top meals by order count
      admin.from('order_items').select('meal_id, meals(name)').limit(100),
    ]);

    // Compute revenue KPIs
    const todayOrdersData = (todayOrders.data ?? []) as { id: string; total: number; status: string }[];
    const monthOrdersData = (monthOrders.data ?? []) as { id: string; total: number; status: string }[];

    const revenueToday = todayOrdersData.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0);
    const revenueMonth = monthOrdersData.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0);
    const ordersToday = todayOrdersData.length;
    const avgOrderValue = ordersToday > 0 ? revenueToday / Math.max(1, todayOrdersData.filter(o => o.status === 'delivered').length) : 0;

    // Acceptance rate
    const totalOrders = monthOrdersData.length;
    const cancelled = monthOrdersData.filter(o => o.status === 'cancelled').length;
    const acceptanceRate = totalOrders > 0 ? Math.round(((totalOrders - cancelled) / totalOrders) * 100) : 0;

    // Top meals
    const mealCounts = new Map<string, { name: string; count: number }>();
    for (const item of (topMeals.data ?? []) as { meal_id: string; meals: { name: string } | null }[]) {
      const key = item.meal_id;
      const name = item.meals?.name ?? 'غير معروف';
      mealCounts.set(key, { name, count: (mealCounts.get(key)?.count ?? 0) + 1 });
    }
    const topMealsResult = Array.from(mealCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const result = {
      kpis: {
        revenue_today: revenueToday,
        revenue_month: revenueMonth,
        orders_today: ordersToday,
        avg_order_value: Math.round(avgOrderValue),
        pending_orders: pendingOrders.count ?? 0,
        preparing_orders: preparingOrders.count ?? 0,
        delivered_today: deliveredToday.count ?? 0,
        cancelled_today: cancelledToday.count ?? 0,
        acceptance_rate: acceptanceRate,
        open_complaints: openComplaints.count ?? 0,
        unread_chats: unreadChats.count ?? 0,
        active_cooks: activeCooks.count ?? 0,
        new_customers_month: newCustomersMonth.count ?? 0,
      },
      recent_orders: recentOrders.data ?? [],
      top_meals: topMealsResult,
      generated_at: now.toISOString(),
    };

    console.log('[analytics] computed for admin:', user.id, 'revenue_today:', revenueToday);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    console.error('[analytics] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
