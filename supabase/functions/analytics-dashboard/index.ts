// supabase/functions/analytics-dashboard/index.ts
// Computes all dashboard KPIs in a single optimized call.
// Per 10_ANALYTICS_AND_REPORTING.md: Dashboard Load < 2 seconds.
// Admin only — validates JWT and role before computing.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  corsHeaders,
  enforceRateLimit,
  errorResponse,
  jsonResponse,
  requestKey,
  requireActiveAdmin,
  requireMethod,
} from '../_shared/http-security.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    requireMethod(req, 'GET');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const user = await requireActiveAdmin(admin, req);
    await enforceRateLimit(admin, requestKey(req, 'analytics-dashboard', user.id), 30);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data, error } = await admin.rpc('get_admin_dashboard_snapshot', {
      p_today_start: todayStart,
      p_month_start: monthStart,
    });
    if (error) throw error;

    console.log('[analytics] aggregate snapshot computed for admin:', user.id);
    return jsonResponse(data);
  } catch (err) {
    console.error('[analytics] error:', err instanceof Error ? err.message : 'UNEXPECTED_ERROR');
    return errorResponse(err);
  }
});
