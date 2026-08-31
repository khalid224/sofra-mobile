import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-webhook-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function requireMethod(req: Request, method: 'GET' | 'POST'): void {
  if (req.method !== method) throw new HttpError(405, 'METHOD_NOT_ALLOWED');
}

export async function readJsonLimited<T>(req: Request, maxBytes: number): Promise<T> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, 'REQUEST_TOO_LARGE');
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, 'REQUEST_TOO_LARGE');
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return mismatch === 0;
}

export function requireSecret(req: Request, headerName: string, envName: string): void {
  const expected = Deno.env.get(envName) ?? '';
  const supplied = req.headers.get(headerName) ?? '';
  if (expected.length < 32) throw new HttpError(500, `${envName}_NOT_CONFIGURED`);
  if (!constantTimeEqual(supplied, expected)) throw new HttpError(401, 'UNAUTHORIZED');
}

export function bearerToken(req: Request): string {
  const value = req.headers.get('Authorization') ?? '';
  if (!value.startsWith('Bearer ') || value.length <= 7) throw new HttpError(401, 'UNAUTHORIZED');
  return value.slice(7);
}

export async function requireActiveAdmin(admin: SupabaseClient, req: Request): Promise<User> {
  const { data: { user }, error } = await admin.auth.getUser(bearerToken(req));
  if (error || !user) throw new HttpError(401, 'UNAUTHORIZED');
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile.status !== 'active') {
    throw new HttpError(403, 'ACTIVE_ADMIN_REQUIRED');
  }
  return user;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function enforceRateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new HttpError(429, 'RATE_LIMIT_EXCEEDED');
  current.count += 1;
  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}

export function requestKey(req: Request, scope: string, identity?: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${identity ?? forwarded ?? 'unknown'}`;
}

export function errorResponse(error: unknown): Response {
  const status = error instanceof HttpError ? error.status : 400;
  const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
  return jsonResponse({ error: message }, status);
}
