// Compatibility wrapper around the authoritative place_order_atomic_v2 RPC.
// Pricing, stock, identity and delivery snapshots are all enforced in SQL.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.24.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z.string().trim().min(10).max(30),
  customer_email: z.string().trim().email().optional().or(z.literal('')),
  delivery_address: z.string().trim().min(5).max(500),
  delivery_city: z.string().trim().min(2).max(100).optional(),
  delivery_area: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(1000).optional(),
  payment_method: z.literal('cash'),
  estimated_delivery: z.string().datetime().optional(),
  scheduled_for: z.string().datetime().optional(),
  is_scheduled: z.boolean().optional(),
  items: z.array(z.object({
    meal_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
    customer_notes: z.string().trim().max(500).optional(),
    today_special_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    extras: z.array(z.object({ id: z.string().uuid() })).optional(),
  })).min(1).max(30),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('يجب تسجيل الدخول قبل إتمام الطلب');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) throw new Error('جلسة المستخدم غير صالحة');

    const input = schema.parse(await req.json());
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error } = await userClient.rpc('place_order_atomic_v2', {
      p_payload: {
        payment_method: input.payment_method,
        notes: input.notes ?? null,
        scheduled_for: input.scheduled_for ?? input.estimated_delivery ?? null,
        is_scheduled: input.is_scheduled ?? false,
        delivery: {
          name: input.customer_name,
          phone: input.customer_phone,
          email: input.customer_email || null,
          address: input.delivery_address,
          // Kept only for compatibility with the legacy DB snapshot.
          city: input.delivery_city || input.delivery_area,
          area: input.delivery_area,
        },
        items: input.items,
      },
    });
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
