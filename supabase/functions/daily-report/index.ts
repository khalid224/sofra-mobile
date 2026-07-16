// supabase/functions/daily-report/index.ts
// Generates the daily operations report per 10_ANALYTICS_AND_REPORTING.md.
// Schedule via pg_cron or Supabase cron: '0 9 * * *' (daily at 9:00 AM)
// Or call manually from admin dashboard.

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

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    const dayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1).toISOString();

    console.log(`[daily-report] generating for: ${dayStart} -> ${dayEnd}`);

    const [ordersRes, complaintsRes, reviewsRes, newCustomersRes] = await Promise.all([
      admin.from('orders').select('id, total, status, cook_id').gte('created_at', dayStart).lt('created_at', dayEnd),
      admin.from('complaints').select('id, status').gte('created_at', dayStart).lt('created_at', dayEnd),
      admin.from('reviews').select('id, rating').gte('created_at', dayStart).lt('created_at', dayEnd),
      admin.from('profiles').select('id').eq('role', 'customer').gte('created_at', dayStart).lt('created_at', dayEnd),
    ]);

    const orders = (ordersRes.data ?? []) as { id: string; total: number; status: string; cook_id: string | null }[];
    const delivered = orders.filter(o => o.status === 'delivered');
    const cancelled = orders.filter(o => o.status === 'cancelled');
    const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
    const avgOrderValue = delivered.length > 0 ? revenue / delivered.length : 0;

    const reviews = (reviewsRes.data ?? []) as { id: string; rating: number }[];
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    const report = {
      date: yesterday.toISOString().split('T')[0],
      orders: {
        total: orders.length,
        delivered: delivered.length,
        cancelled: cancelled.length,
        cancellation_rate: orders.length > 0 ? Math.round((cancelled.length / orders.length) * 100) : 0,
      },
      revenue: {
        total: revenue,
        avg_order_value: Math.round(avgOrderValue),
      },
      complaints: {
        new: (complaintsRes.data ?? []).length,
      },
      reviews: {
        new: reviews.length,
        avg_rating: Math.round(avgRating * 10) / 10,
      },
      customers: {
        new: (newCustomersRes.data ?? []).length,
      },
      generated_at: now.toISOString(),
    };

    // Store report in DB
    await admin.from('app_settings').upsert({
      key: `report_daily_${report.date}`,
      value: JSON.stringify(report),
      description: `تقرير يومي: ${report.date}`,
      updated_at: now.toISOString(),
    });

    // Send push notification to all admins
    const { data: adminTokens } = await admin
      .from('device_tokens')
      .select('token, user_id')
      .in(
        'user_id',
        (await admin.from('profiles').select('id').eq('role', 'admin').eq('status', 'active')).data?.map((p: { id: string }) => p.id) ?? [],
      );

    if (adminTokens && adminTokens.length > 0) {
      const messages = (adminTokens as { token: string }[]).map(t => ({
        to: t.token,
        title: `📊 تقرير ${report.date}`,
        body: `${orders.length} طلب | إيراد: ${revenue} جنيه | تقييم: ${avgRating.toFixed(1)}⭐`,
        sound: 'default',
        data: { type: 'daily_report', date: report.date },
      }));
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    console.log('[daily-report] done:', JSON.stringify(report.orders));
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    console.error('[daily-report] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
