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
import {
  corsHeaders,
  enforceRateLimit,
  errorResponse,
  jsonResponse,
  readJsonLimited,
  requestKey,
  requireMethod,
  requireSecret,
} from '../_shared/http-security.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Maps each notification_type to its user preference column in notification_preferences
const PREF_KEY_MAP: Record<string, string> = {
  promotion: 'notify_specials',
  today_special: 'notify_specials',
  new_order: 'notify_orders',
  order_received: 'notify_orders',
  order_accepted: 'notify_orders',
  order_preparing: 'notify_orders',
  order_ready: 'notify_orders',
  order_out_for_delivery: 'notify_orders',
  order_delivered: 'notify_orders',
  order_cancelled: 'notify_orders',
  chat_reply: 'notify_chat',
};

const schema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(500),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= 16_384, 'Notification data is too large')
    .optional(),
  notification_type: z.string().max(64).optional(),
  // Optional geographic segmentation — for targeted broadcasts
  segmentation: z
    .object({
      cities: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
      areas: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    }).strict()
    .optional(),
}).strict();

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string } & Record<string, unknown>;
};

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify(error, Object.getOwnPropertyNames(error));
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function sendExpoBatch(batch: Array<Record<string, unknown>>): Promise<ExpoPushTicket[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const expoRes = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });
      const rawResult = await expoRes.text();
      if (!expoRes.ok) throw new Error(`EXPO_HTTP_${expoRes.status}: ${rawResult}`);

      const result = JSON.parse(rawResult) as { data?: ExpoPushTicket[] };
      const tickets = result.data ?? [];
      if (tickets.length !== batch.length) {
        throw new Error(`EXPO_TICKET_COUNT_MISMATCH: ${rawResult}`);
      }
      return tickets;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('EXPO_PUSH_FAILED');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    requireMethod(req, 'POST');
    requireSecret(req, 'x-webhook-secret', 'WEBHOOK_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('Missing required Supabase Edge Function secrets');
    }
    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );
    await enforceRateLimit(admin, requestKey(req, 'send-push'), 120);

    const body = await readJsonLimited<unknown>(req, 262_144);
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
      console.log('[send-push] status: ok | no device tokens found');
      return jsonResponse({ ok: true, sent: 0 });
    }

    // ── 2. Filter by notification preferences ──
    let eligibleUserIds = [...input.user_ids];

    if (prefKey) {
      const { data: prefs, error: prefErr } = await admin
        .from('notification_preferences')
        .select(`user_id, ${prefKey}`)
        .in('user_id', input.user_ids);
      if (prefErr) throw prefErr;

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
      const { data: addresses, error: addressErr } = await admin
        .from('customer_addresses')
        .select('customer_id, city')
        .in('customer_id', eligibleUserIds)
        .eq('is_default', true);
      if (addressErr) throw addressErr;

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
    const tokens = (allTokens as { token: string; user_id: string }[]).filter(
      (item) =>
        eligibleSet.has(item.user_id) &&
        /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(item.token),
    );

    if (tokens.length === 0) {
      console.log('[send-push] no eligible tokens after filtering');
      return jsonResponse({ ok: true, sent: 0, filtered_out: allTokens.length });
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      channelId: 'default',
    }));

    // ── 5. Send in batches of 100 (Expo limit) ──
    const BATCH_SIZE = 100;
    let totalAccepted = 0;
    let totalRejected = 0;
    const ticketErrors: Array<Record<string, unknown>> = [];
    const invalidTokens: string[] = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const tickets = await sendExpoBatch(batch);

      tickets.forEach((ticket, ticketIndex) => {
        if (ticket.status === 'ok') {
          totalAccepted += 1;
          return;
        }
        totalRejected += 1;
        if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(String(batch[ticketIndex].to));
        }
        ticketErrors.push({
          batch: Math.floor(i / BATCH_SIZE) + 1,
          index: ticketIndex,
          message: ticket.message,
          details: ticket.details,
        });
      });

      console.log(
        '[send-push] expo batch:',
        JSON.stringify({
          batch: Math.floor(i / BATCH_SIZE) + 1,
          messages: batch.length,
          accepted: tickets.filter((ticket) => ticket.status === 'ok').length,
          rejected: tickets.filter((ticket) => ticket.status === 'error').length,
          tickets,
        }),
      );
    }

    if (invalidTokens.length > 0) {
      const { error: cleanupError } = await admin
        .from('device_tokens')
        .delete()
        .in('token', [...new Set(invalidTokens)]);
      if (cleanupError) console.error('[send-push] token cleanup failed:', cleanupError.message);
    }

    const responseBody = {
      ok: totalRejected === 0,
      sent: totalAccepted,
      rejected: totalRejected,
      errors: ticketErrors,
    };
    console.log(
      `[send-push] status: ${totalRejected === 0 ? 'ok' : 'partial_error'} | result:`,
      JSON.stringify(responseBody),
    );
    return jsonResponse(responseBody, totalAccepted === 0 && totalRejected > 0 ? 502 : 200);
  } catch (err) {
    console.error('[send-push] status: error | full_error:', serializeError(err));
    return errorResponse(err);
  }
});
