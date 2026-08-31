// supabase/functions/update-order-status/index.ts
// Central service for all order status changes — creates timeline, triggers notifications.
// Per 06_API_AND_EDGE_FUNCTIONS.md: "Every status change passes through this function."

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.24.2';
import {
  corsHeaders,
  enforceRateLimit,
  errorResponse,
  jsonResponse,
  readJsonLimited,
  requestKey,
  requireActiveAdmin,
  requireMethod,
} from '../_shared/http-security.ts';

const ORDER_STATUSES = ['pending_admin', 'dispatching', 'waiting_cook', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] as const;

const schema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
  notes: z.string().trim().max(500).optional(),
}).strict();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    requireMethod(req, 'POST');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const user = await requireActiveAdmin(admin, req);
    enforceRateLimit(requestKey(req, 'update-order-status', user.id), 60);

    const body = await readJsonLimited<unknown>(req, 4_096);
    const input = schema.parse(body);

    console.log('[update-status] order:', input.order_id, 'status:', input.status);

    // Get current order to verify it exists and get customer_id
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, status, order_number')
      .eq('id', input.order_id)
      .single();
    if (orderErr || !order) throw new Error('الطلب غير موجود');

    // Update order status
    const { error: updateErr } = await admin
      .from('orders')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', input.order_id);
    if (updateErr) throw updateErr;

    // Migration 0021 owns timeline creation and notification enqueueing in a
    // database trigger, so every caller follows exactly the same path.

    console.log('[update-status] done:', input.order_id, '->', input.status);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[update-status] error:', err instanceof Error ? err.message : 'UNEXPECTED_ERROR');
    return errorResponse(err);
  }
});
