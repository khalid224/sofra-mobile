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

const STATUS_NOTIFICATIONS: Partial<Record<typeof ORDER_STATUSES[number], { title: string; body: string; type: string }>> = {
  accepted: { title: '✅ تم قبول طلبك', body: 'طلبك تم قبوله وسيبدأ التحضير قريباً', type: 'order_accepted' },
  preparing: { title: '👨‍🍳 جاري التحضير', body: 'الطاهي بدأ في تحضير طلبك', type: 'order_preparing' },
  ready: { title: '🎉 طلبك جاهز', body: 'طلبك جاهز وسيتم تسليمه للمندوب', type: 'order_ready' },
  out_for_delivery: { title: '🚗 المندوب في الطريق', body: 'طلبك في الطريق إليك!', type: 'order_out_for_delivery' },
  delivered: { title: '🏠 تم التوصيل', body: 'تم توصيل طلبك. شكراً لثقتك بـ sofra!', type: 'order_delivered' },
  cancelled: { title: '❌ تم إلغاء الطلب', body: 'نعتذر، تم إلغاء طلبك. تواصل معنا لمزيد من التفاصيل.', type: 'order_cancelled' },
};

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

    const { data: roleData } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (roleData?.role !== 'admin') throw new Error('غير مصرح — المديرون فقط');

    const body = await req.json();
    const input = schema.parse(body);

    console.log('[update-status] order:', input.order_id, 'status:', input.status);

    // Get current order to verify it exists and get customer_id
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, customer_id, status, order_number')
      .eq('id', input.order_id)
      .single();
    if (orderErr || !order) throw new Error('الطلب غير موجود');

    // Update order status
    const { error: updateErr } = await admin
      .from('orders')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', input.order_id);
    if (updateErr) throw updateErr;

    // Insert timeline event
    await admin.from('order_timeline').insert({
      order_id: input.order_id,
      status: input.status,
      created_by: user.id,
      notes: input.notes ?? null,
    });

    // Send push notification to customer
    const notifTemplate = STATUS_NOTIFICATIONS[input.status];
    if (notifTemplate && order.customer_id) {
      // Fetch customer device tokens
      const { data: tokens } = await admin
        .from('device_tokens')
        .select('token')
        .eq('user_id', order.customer_id);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: { token: string }) => ({
          to: t.token,
          sound: 'default',
          title: notifTemplate.title,
          body: notifTemplate.body,
          data: { type: notifTemplate.type, order_id: input.order_id },
        }));
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
      }

      // Log notification in DB
      await admin.from('notifications').insert({
        user_id: order.customer_id,
        title: notifTemplate.title,
        body: notifTemplate.body,
        type: notifTemplate.type,
        is_read: false,
      });
    }

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
