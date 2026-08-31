// supabase/functions/update-order-status/index.ts
// Central service for all order status changes — creates timeline, triggers notifications.
// Per 06_API_AND_EDGE_FUNCTIONS.md: "Every status change passes through this function."

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.24.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORDER_STATUSES = ['pending_admin', 'dispatching', 'waiting_cook', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] as const;

const schema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
  notes: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('غير مصرح');
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('غير مصرح');

    const { data: roleData } = await admin.from('profiles').select('role, status').eq('id', user.id).single();
    if (roleData?.role !== 'admin' || roleData.status !== 'active') {
      throw new Error('غير مصرح — المديرون النشطون فقط');
    }

    const body = await req.json();
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
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    console.error('[update-status] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
