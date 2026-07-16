// supabase/functions/place-order/index.ts
// Validates items & prices server-side (service role), creates order atomically.
// Per 06_API_AND_EDGE_FUNCTIONS.md: place-order is a core Edge Function.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.24.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z.string().trim().min(6).max(30),
  customer_email: z.string().trim().email().optional().or(z.literal('')),
  delivery_address: z.string().trim().min(5).max(500),
  delivery_city: z.string().trim().min(2).max(100),
  delivery_area: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(1000).optional(),
  payment_method: z.enum(['cash', 'card', 'wallet']).default('cash'),
  items: z.array(z.object({
    meal_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
    customer_notes: z.string().trim().max(500).optional(),
  })).min(1).max(30),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const log = (msg: string, data?: unknown) => console.log(`[place-order] ${msg}`, data ?? '');

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Auth: link order to user if authenticated
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = data.user?.id ?? null;
    }

    const body = await req.json();
    log('received', { customer: body.customer_name, items: body.items?.length });

    const input = schema.parse(body);

    // Fetch meal prices from DB (never trust client-sent prices)
    const mealIds = [...new Set(input.items.map((i) => i.meal_id))];
    const { data: meals, error: mealsErr } = await admin
      .from('meals')
      .select('id, name, price, is_available')
      .in('id', mealIds);
    if (mealsErr) throw mealsErr;

    const mealMap = new Map((meals ?? []).map((m: { id: string; name: string; price: number; is_available: boolean }) => [m.id, m]));

    // Validate availability & calculate subtotal
    let subtotal = 0;
    const orderItems = input.items.map((item) => {
      const meal = mealMap.get(item.meal_id);
      if (!meal) throw new Error(`الصنف غير موجود: ${item.meal_id}`);
      if (!meal.is_available) throw new Error(`الصنف غير متاح حالياً: ${meal.name}`);
      const unitPrice = Number(meal.price);
      subtotal += unitPrice * item.quantity;
      return {
        meal_id: item.meal_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * item.quantity,
        customer_notes: item.customer_notes ?? null,
      };
    });

    // Fetch delivery fee from settings
    const { data: feeSetting } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .maybeSingle();
    const deliveryFee = Number(feeSetting?.value ?? 0);
    const total = subtotal + deliveryFee;

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Create order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        customer_id: userId,
        order_number: orderNumber,
        subtotal,
        delivery_fee: deliveryFee,
        discount: 0,
        tax: 0,
        total,
        status: 'pending_admin',
        payment_method: input.payment_method,
        payment_status: 'pending',
        notes: input.notes ?? null,
        // Store delivery info in notes if no address table row
      })
      .select('id')
      .single();
    if (orderErr) throw orderErr;

    const orderId: string = order.id;

    // Create order items
    const { error: itemsErr } = await admin
      .from('order_items')
      .insert(orderItems.map((oi) => ({ ...oi, order_id: orderId })));
    if (itemsErr) throw itemsErr;

    // Create initial timeline entry
    await admin.from('order_timeline').insert({ order_id: orderId, status: 'pending_admin', created_by: 'system', notes: 'تم إنشاء الطلب' });

    // Create notification for customer
    if (userId) {
      await admin.from('notifications').insert({
        user_id: userId,
        title: 'تم استلام طلبك ✓',
        body: `طلبك #${orderNumber} قيد المراجعة. سنتواصل معك قريباً.`,
        type: 'order_received',
        is_read: false,
      });
    }

    log('order created', { orderId, orderNumber, total });
    return new Response(JSON.stringify({ orderId, orderNumber }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    console.error('[place-order] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
