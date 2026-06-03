import { headers } from 'next/headers';

import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Throttling for the public, unauthenticated opportunity password gate.
//
// Two abuse vectors are throttled with DB-backed windowed counters (see
// supabase/migrations/0011_gate_rate_limits.sql) so the limits hold across the
// stateless serverless instances Vercel runs:
//   (a) brute-forcing the gate password — capped per client IP + opportunity
//       slug across BOTH gate Server Actions (both re-check the password), and
//   (b) email bombing — code issuance capped per recipient email and per IP.
//
// Bucket keys only contain coarse identifiers (IP, slug, email); no codes or
// passwords are ever stored or logged.

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

// Password attempts: generous enough that a legitimate visitor who mistypes or
// resends a code a few times is never locked out, while making online
// brute-force of the shared gate password infeasible.
export const GATE_PASSWORD_MAX_ATTEMPTS = 10;
export const GATE_PASSWORD_WINDOW_SECONDS = 10 * 60;

// Code issuance: cap how many verification emails a single recipient can be
// sent (anti-bombing) and how many a single source IP can trigger.
export const GATE_CODE_MAX_PER_EMAIL = 5;
export const GATE_CODE_EMAIL_WINDOW_SECONDS = 15 * 60;
export const GATE_CODE_MAX_PER_IP = 20;
export const GATE_CODE_IP_WINDOW_SECONDS = 15 * 60;

// Resolve the client IP from proxy headers. `x-forwarded-for` may be a
// comma-separated chain; the first hop is the client. Falls back to
// `x-real-ip`, then a shared sentinel when no IP is available so requests are
// still bucketed (and throttled together) rather than bypassing the limit.
export async function getClientIp(): Promise<string> {
  const headerList = await headers();

  const forwardedFor = headerList.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = headerList.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

// Atomically increment the bucket's windowed counter and return the new count
// within the current window. Returns null if the throttle backend is
// unavailable; callers treat null as "do not block" so a counter outage never
// takes the gate down (the password check itself still runs on every request).
export async function incrementGateRateLimit(
  supabase: AdminSupabaseClient,
  bucketKey: string,
  windowSeconds: number,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_gate_rate_limit', {
    p_bucket_key: bucketKey,
    p_window_seconds: windowSeconds,
  });

  if (error || typeof data !== 'number') {
    return null;
  }

  return data;
}

// True once the bucket's count has exceeded its allowed maximum for the window.
// A null count (backend unavailable) is treated as not-exceeded.
export function gateRateLimitExceeded(count: number | null, max: number): boolean {
  return count !== null && count > max;
}
