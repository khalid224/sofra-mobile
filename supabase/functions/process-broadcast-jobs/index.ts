import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  corsHeaders,
  enforceRateLimit,
  errorResponse,
  jsonResponse,
  requestKey,
  requireMethod,
  requireSecret,
} from '../_shared/http-security.ts';

const BATCH_SIZE = 250;

type BroadcastJob = {
  id: string;
  payload: {
    title?: string;
    body?: string;
    notification_type?: string;
    data?: Record<string, unknown>;
  };
  cursor_user_id: string | null;
  processed_count: number;
  failure_count: number;
};

async function postWithRetry(url: string, secret: string, body: unknown): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`PUSH_WORKER_HTTP_${response.status}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('PUSH_WORKER_FAILED');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

  try {
    requireMethod(req, 'POST');
    requireSecret(req, 'x-cron-secret', 'CRON_SECRET');
    if (!serviceRoleKey || !supabaseUrl || !webhookSecret) throw new Error('WORKER_SECRETS_MISSING');

    const admin = createClient(supabaseUrl, serviceRoleKey);
    await enforceRateLimit(admin, requestKey(req, 'process-broadcast-jobs'), 30);

    const { data: claimed, error: claimError } = await admin.rpc('claim_next_broadcast_job');
    if (claimError) throw claimError;
    const job = (claimed as BroadcastJob[] | null)?.[0];
    if (!job) return jsonResponse({ ok: true, processed: 0, idle: true });

    try {
      let customersQuery = admin
        .from('profiles')
        .select('id')
        .eq('role', 'customer')
        .eq('status', 'active')
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);
      if (job.cursor_user_id) customersQuery = customersQuery.gt('id', job.cursor_user_id);

      const { data: customers, error: customersError } = await customersQuery;
      if (customersError) throw customersError;
      const userIds = (customers ?? []).map((customer) => customer.id);

      if (userIds.length === 0) {
        const { error: completeError } = await admin.from('broadcast_jobs').update({
          status: 'completed',
          locked_at: null,
          failure_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);
        if (completeError) throw completeError;
        return jsonResponse({ ok: true, job_id: job.id, processed: 0, completed: true });
      }

      const title = String(job.payload.title ?? '').slice(0, 200);
      const body = String(job.payload.body ?? '').slice(0, 500);
      const notificationType = String(job.payload.notification_type ?? 'promotion').slice(0, 64);
      const notificationData = { ...(job.payload.data ?? {}), broadcast_job_id: job.id };

      const notificationRows = userIds.map((userId) => ({
        user_id: userId,
        title,
        body,
        type: notificationType,
        is_read: false,
        data: notificationData,
        broadcast_job_id: job.id,
      }));
      const { error: notificationError } = await admin
        .from('notifications')
        .upsert(notificationRows, { onConflict: 'user_id,broadcast_job_id', ignoreDuplicates: true });
      if (notificationError) throw notificationError;

      await postWithRetry(`${supabaseUrl}/functions/v1/send-push-notification`, webhookSecret, {
        user_ids: userIds,
        title,
        body,
        notification_type: notificationType,
        data: notificationData,
      });

      const completed = userIds.length < BATCH_SIZE;
      const { error: progressError } = await admin.from('broadcast_jobs').update({
        cursor_user_id: userIds[userIds.length - 1],
        processed_count: job.processed_count + userIds.length,
        status: completed ? 'completed' : 'pending',
        next_attempt_at: new Date().toISOString(),
        locked_at: null,
        failure_count: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      if (progressError) throw progressError;

      return jsonResponse({ ok: true, job_id: job.id, processed: userIds.length, completed });
    } catch (jobError) {
      console.error('[broadcast-worker] batch failed:', jobError);
      const failures = job.failure_count + 1;
      const nextAttempt = new Date(Date.now() + Math.min(3_600_000, 30_000 * (2 ** job.failure_count)));
      await admin.from('broadcast_jobs').update({
        status: failures >= 5 ? 'failed' : 'pending',
        failure_count: failures,
        next_attempt_at: nextAttempt.toISOString(),
        locked_at: null,
        last_error: 'BROADCAST_BATCH_FAILED',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      throw jobError;
    }
  } catch (error) {
    console.error('[broadcast-worker] request failed:', error);
    return errorResponse(error);
  }
});
