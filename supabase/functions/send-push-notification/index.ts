// supabase/functions/send-push-notification/index.ts
// Sends Expo push notifications with:
//  - Notification preference filtering (user opt-in/opt-out per type)
//  - Geographic segmentation (city/area targeting)
//  - Batched Expo API calls (100 per batch)
//
// Intended call flow:
//   DB trigger inserts into `notifications` table
//   → Supabase Database Webhook fires this Edge Function
//   → This function resolves device tokens, filters by preferences, and calls Expo Push API

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.24.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Maps each notification_type to its user preference column in notification_preferences
const PREF_KEY_MAP: Record<string, string> = {
  promotion:              'notify_specials',
  order_received:         'notify_orders',
  order_accepted:         'notify_orders',
  order_preparing:        'notify_orders',
  order_ready:            'notify_orders',
  order_out_for_delivery: 'notify_orders',
  order_delivered:        'notify_orders',
  order_cancelled:        'notify_orders',
  chat_reply:             'notify_chat',
};

const schema = z.object({
  user_ids:          z.array(z.string().uuid()).min(1),
  title:             z.string().min(1).max(200),
  body:              z.string().min(1).max(500),
  data:              z.record(z.string(), z.unknown()).optional(),
  notification_type: z.string().optional(),
  // Optional geographic segmentation — for targeted broadcasts
  segmentation: z
    .object({
      cities: z.array(z.string()).optional(),
      areas:  z.array(z.string()).optional(),
    })
    .optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const input = schema.parse(body);

    const prefKey = input.notification_type
      ? PREF_KEY_MAP[input.notification_type]
      : undefined;

    console.log(
      '[send-push] users:', input.user_ids.length,
      '| type:', input.notification_type,
      '| pref_key:', prefKey,
    );

    // ── 1. Fetch all device tokens for target users ──
    const { data: allTokens, error: tokenErr } = await admin
      .from('device_tokens')
      .select('token, user_id')
      .in('user_id', input.user_ids);
    if (tokenErr) throw tokenErr;

    if (!allTokens || allTokens.length === 0) {
      console.log('[send-push] no device tokens found');
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Filter by notification preferences ──
    let eligibleUserIds = [...input.user_ids];

    if (prefKey) {
      const { data: prefs } = await admin
        .from('notification_preferences')
        .select(`user_id, ${prefKey}`)
        .in('user_id', input.user_ids);

      const prefMap = new Map<string, boolean>();
      for (const p of prefs ?? []) {
        prefMap.set(p.user_id, (p as Record<string, unknown>)[prefKey] !== false);
      }

      // Users with no preference row default to opted-in (true)
      eligibleUserIds = eligibleUserIds.filter((uid) => prefMap.get(uid) !== false);
      console.log('[send-push] after pref filter:', eligibleUserIds.length, '/', input.user_ids.length);
    }

    // ── 3. Apply geographic segmentation if requested ──
    if (input.segmentation?.cities && input.segmentation.cities.length > 0) {
      const { data: addresses } = await admin
        .from('customer_addresses')
        .select('customer_id, city')
        .in('customer_id', eligibleUserIds)
        .eq('is_default', true);

      const cityMap = new Map<string, string>();
      for (const a of addresses ?? []) {
        const addr = a as { customer_id: string; city: string };
        cityMap.set(addr.customer_id, addr.city);
      }

      const targetCities = new Set(
        input.segmentation.cities.map((c) => c.toLowerCase()),
      );
      eligibleUserIds = eligibleUserIds.filter((uid) => {
        const city = cityMap.get(uid)?.toLowerCase();
        return city && targetCities.has(city);
      });
      console.log('[send-push] after city filter:', eligibleUserIds.length);
    }

    // ── 4. Build message list for eligible tokens ──
    const eligibleSet = new Set(eligibleUserIds);
    const tokens = (allTokens as { token: string; user_id: string }[]).filter((t) =>
      eligibleSet.has(t.user_id),
    );

    if (tokens.length === 0) {
      console.log('[send-push] no eligible tokens after filtering');
      return new Response(
        JSON.stringify({ ok: true, sent: 0, filtered_out: allTokens.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const messages = tokens.map((t) => ({
      to:        t.token,
      sound:     'default',
      title:     input.title,
      body:      input.body,
      data:      input.data ?? {},
      channelId: 'default',
    }));

    // ── 5. Send in batches of 100 (Expo limit) ──
    const BATCH_SIZE = 100;
    let totalSent = 0;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const expoRes = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(batch),
      });
      const result = await expoRes.json();
      console.log('[send-push] batch', Math.floor(i / BATCH_SIZE) + 1, 'sent', batch.length, 'result:', JSON.stringify(result).slice(0, 100));
      totalSent += batch.length;
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    console.error('[send-push] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
