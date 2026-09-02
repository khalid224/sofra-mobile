// supabase/functions/daily-report/index.ts
// Generates the daily operations report per 10_ANALYTICS_AND_REPORTING.md.
// Schedule via pg_cron or Supabase cron: '0 9 * * *' (daily at 9:00 AM)
// Or call manually from admin dashboard.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  corsHeaders,
  enforceRateLimit,
  errorResponse,
  HttpError,
  jsonResponse,
  requestKey,
  requireActiveAdmin,
  requireMethod,
  requireSecret,
} from '../_shared/http-security.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    requireMethod(req, 'POST');
    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > 1_024 || (await req.arrayBuffer()).byteLength > 1_024) {
      throw new HttpError(413, 'REQUEST_TOO_LARGE');
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
    );

    let generatedBy: string | null = null;
    let caller = 'cron';
    if (req.headers.has('x-cron-secret')) {
      requireSecret(req, 'x-cron-secret', 'CRON_SECRET');
    } else {
      const user = await requireActiveAdmin(admin, req);
      generatedBy = user.id;
      caller = user.id;
    }
    await enforceRateLimit(admin, requestKey(req, 'daily-report', caller), 5, 60 * 60);

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
    const { error: reportError } = await admin.from('daily_reports').upsert({
      report_date: report.date,
      report,
      generated_at: now.toISOString(),
      generated_by: generatedBy,
      updated_at: now.toISOString(),
    });
    if (reportError) throw reportError;

    // Use the canonical notifications pipeline; it owns timeout, retry,
    // preferences and invalid-token cleanup.
    const { data: activeAdmins, error: adminsError } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active');
    if (adminsError) throw adminsError;
    if ((activeAdmins?.length ?? 0) > 0) {
      const { error: notificationError } = await admin.from('notifications').insert(
        (activeAdmins ?? []).map((profile: { id: string }) => ({
          user_id: profile.id,
          title: `📊 تقرير ${report.date}`,
          body: `${orders.length} طلب | إيراد: ${revenue} جنيه | تقييم: ${avgRating.toFixed(1)}⭐`,
          type: 'promotion',
          is_read: false,
          data: { type: 'daily_report', date: report.date },
        })),
      );
      if (notificationError) throw notificationError;
    }

    console.log('[daily-report] done:', JSON.stringify(report.orders));
    return jsonResponse(report);
  } catch (err) {
    console.error('[daily-report] error:', err instanceof Error ? err.message : 'UNEXPECTED_ERROR');
    return errorResponse(err);
  }
});
