/**
 * Best-effort in-process token bucket, keyed by API key id. Per app instance —
 * good enough to blunt runaway clients. For hard multi-instance limits, move
 * this to Postgres or a shared cache later.
 */
const CAPACITY = 120; // burst
const REFILL_PER_SEC = 2; // sustained ~120 req/min

type Bucket = { tokens: number; updated: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(keyId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(keyId) ?? { tokens: CAPACITY, updated: now };
  const elapsed = (now - b.updated) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_SEC);
  b.updated = now;

  if (b.tokens < 1) {
    buckets.set(keyId, b);
    return { ok: false, retryAfterSec: Math.ceil((1 - b.tokens) / REFILL_PER_SEC) };
  }
  b.tokens -= 1;
  buckets.set(keyId, b);
  return { ok: true };
}
