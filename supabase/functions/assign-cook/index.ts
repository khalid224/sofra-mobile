// supabase/functions/assign-cook/index.ts
// Dispatch Engine — Scores and assigns cooks to orders.
// Preferred cook bonus is loaded from app_settings.preferred_cook_bonus (configurable, not hardcoded).
// Cook assignment NEVER happens at order creation — only via this engine after pending_admin.

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

const schema = z.object({
  order_id: z.string().uuid(),
  cook_id: z.string().uuid().optional(), // If provided, skip recommendation and assign directly
}).strict();

interface Cook {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  status: string;
  priority: number;
  rating: number;
  acceptance_rate: number;
  completed_orders: number;
  average_preparation_time: number | null;
  specialties: string[] | null;
  latitude: number | null;
  longitude: number | null;
}

function scoreWorkload(activeOrders: number): number {
  if (activeOrders === 0) return 100;
  if (activeOrders === 1) return 80;
  if (activeOrders === 2) return 60;
  if (activeOrders === 3) return 30;
  return 0;
}

function scoreAvailability(status: string): number {
  if (status === 'available') return 100;
  if (status === 'busy') return 25;
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    requireMethod(req, 'POST');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const user = await requireActiveAdmin(admin, req);
    enforceRateLimit(requestKey(req, 'assign-cook', user.id), 20);

    const body = await readJsonLimited<unknown>(req, 4_096);
    const input = schema.parse(body);

    // Fetch order details including customer_id for preferred cook lookup
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, order_number, status, notes, total, customer_id, address_id')
      .eq('id', input.order_id)
      .single();
    if (orderErr || !order) throw new Error('الطلب غير موجود');
    if (!['pending_admin', 'dispatching', 'waiting_cook'].includes(order.status)) {
      throw new Error('لا يمكن تعيين طاهٍ في حالة الطلب الحالية');
    }

    let assignedCookId = input.cook_id;

    // If no cook specified, run recommendation engine
    if (!assignedCookId) {
      // ── Load configurable preferred cook bonus from app_settings ──
      const { data: bonusSetting } = await admin
        .from('app_settings')
        .select('value')
        .eq('key', 'preferred_cook_bonus')
        .maybeSingle();
      const preferredCookBonus = parseFloat(
        String(bonusSetting?.value ?? '200').replace(/"/g, '')
      ) || 200;

      // ── Load customer's preferred cook ──
      const { data: customerProfile } = await admin
        .from('profiles')
        .select('preferred_cook_id')
        .eq('id', order.customer_id)
        .maybeSingle();
      const preferredCookId: string | null =
        (customerProfile as { preferred_cook_id: string | null } | null)?.preferred_cook_id ?? null;

      // ── Fetch all available/busy cooks ──
      const { data: cooks } = await admin
        .from('cooks')
        .select(
          'id, full_name, phone, whatsapp, status, priority, rating, acceptance_rate, completed_orders, average_preparation_time, specialties, latitude, longitude',
        )
        .in('status', ['available', 'busy']);

      if (!cooks || cooks.length === 0) throw new Error('لا يوجد طباخون متاحون حالياً');

      // ── Count active orders per cook (workload) ──
      const { data: activeCounts } = await admin
        .from('orders')
        .select('cook_id')
        .in('status', ['accepted', 'preparing', 'ready'])
        .not('cook_id', 'is', null);

      const workloadMap = new Map<string, number>();
      for (const o of activeCounts ?? []) {
        const c = o as { cook_id: string };
        workloadMap.set(c.cook_id, (workloadMap.get(c.cook_id) ?? 0) + 1);
      }

      // ── Score each cook ──
      // Preferred cook gets a configurable bonus on top of normal score.
      // This ensures a preferred cook who is slightly busier still wins,
      // but if they're completely unavailable (offline/vacation) they score 0 and are skipped.
      const scored = (cooks as Cook[]).map((cook) => {
        const avail = scoreAvailability(cook.status);
        const workload = scoreWorkload(workloadMap.get(cook.id) ?? 0);
        const priorityScore = Math.max(0, (11 - cook.priority) * 10);
        const acceptanceScore = cook.acceptance_rate;
        const ratingScore = (cook.rating / 5) * 100;
        const distanceScore = 50; // Default if no coordinates
        const preferredBonus = cook.id === preferredCookId ? preferredCookBonus : 0;

        const total =
          avail + workload + priorityScore + acceptanceScore + ratingScore + distanceScore + preferredBonus;

        return { cook, score: Math.round(total), isPreferred: cook.id === preferredCookId };
      });

      scored.sort((a, b) => b.score - a.score);
      assignedCookId = scored[0].cook.id;

      console.log(
        '[assign-cook] preferred_cook_id:', preferredCookId,
        '| bonus:', preferredCookBonus,
        '| top 5:', scored
          .slice(0, 5)
          .map((s) => `${s.cook.full_name}(${s.score}${s.isPreferred ? '*' : ''})`)
          .join(', '),
      );
    }

    // ── Fetch the winning cook ──
    const { data: cook } = await admin
      .from('cooks')
      .select('id, full_name, phone, whatsapp, status')
      .eq('id', assignedCookId)
      .single();
    if (!cook) throw new Error('الطاهي غير موجود');

    // ── Update order: assign cook + move to waiting_cook ──
    const { error: assignmentError } = await admin.from('orders').update({
      cook_id: assignedCookId,
      status: 'waiting_cook',
      updated_at: new Date().toISOString(),
    }).eq('id', input.order_id);
    if (assignmentError) throw assignmentError;

    // ── Dispatch history ──
    const { data: lastDispatch } = await admin
      .from('dispatch_history')
      .select('attempt_number')
      .eq('order_id', input.order_id)
      .order('attempt_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const attemptNumber =
      ((lastDispatch as { attempt_number: number } | null)?.attempt_number ?? 0) + 1;

    const { error: dispatchError } = await admin.from('dispatch_history').insert({
      order_id: input.order_id,
      cook_id: assignedCookId,
      attempt_number: attemptNumber,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
    if (dispatchError) throw dispatchError;

    // ── Order timeline ──
    const { error: timelineError } = await admin.from('order_timeline').insert({
      order_id: input.order_id,
      status: 'waiting_cook',
      created_by: user.id,
      notes: `تم إرسال الطلب للطاهي ${cook.full_name} — المحاولة #${attemptNumber}`,
    });
    if (timelineError) throw timelineError;

    // ── Generate WhatsApp message ──
    const { data: orderItems } = await admin
      .from('order_items')
      .select('quantity, unit_price, meal:meals(name)')
      .eq('order_id', input.order_id);

    const itemsText = (orderItems ?? [])
      .map(
        (i: { quantity: number; unit_price: number; meal: { name: string } | null }) =>
          `• ${i.meal?.name ?? 'صنف'} × ${i.quantity} — ${i.unit_price * i.quantity} جنيه`,
      )
      .join('\n');

    const waMessage = `🍽️ *طلب جديد من sofra*\n\nرقم الطلب: #${order.order_number}\n\n*الأصناف:*\n${itemsText}\n\n*الإجمالي:* ${order.total} جنيه\n\n*ملاحظات:* ${order.notes ?? 'لا يوجد'}\n\n---\nللرد:\n✅ موافق\n❌ غير متاح\n📞 اتصل بنا`;
    const waUrl = `https://wa.me/${(cook as { whatsapp: string }).whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(waMessage)}`;

    console.log('[assign-cook] assigned cook:', cook.full_name, 'order:', order.order_number);

    return jsonResponse(
      {
        ok: true,
        cook: { id: cook.id, name: cook.full_name, phone: (cook as { phone: string }).phone },
        whatsapp_url: waUrl,
        attempt: attemptNumber,
      },
    );
  } catch (err) {
    console.error('[assign-cook] error:', err instanceof Error ? err.message : 'UNEXPECTED_ERROR');
    return errorResponse(err);
  }
});
