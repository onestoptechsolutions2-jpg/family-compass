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

type Window = { hits: number[]; expires: number };
const windows = new Map<string, Window>();
/** Never keep more keys than this: a flood of made-up addresses must not be able to fill memory. */
const MAX_KEYS = 20_000;
let calls = 0;

/** Forget windows that have run out, and if there are still too many, the oldest. */
function sweep(now: number) {
  for (const [k, w] of windows) if (w.expires <= now) windows.delete(k);
  if (windows.size > MAX_KEYS) {
    let drop = windows.size - Math.floor(MAX_KEYS * 0.8);
    for (const k of windows.keys()) {
      if (drop-- <= 0) break;
      windows.delete(k);
    }
  }
}

/** Sliding window: at most `max` hits per `windowSec` for `key`. Per app instance. */
export function hitLimit(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  if (++calls % 500 === 0 || windows.size > MAX_KEYS) sweep(now);
  const w = windows.get(key) ?? { hits: [], expires: 0 };
  w.hits = w.hits.filter((t) => now - t < windowSec * 1000);
  w.expires = now + windowSec * 1000;
  windows.set(key, w);
  if (w.hits.length >= max) return false;
  w.hits.push(now);
  return true;
}

/** For tests: how many keys are being remembered. */
export const trackedKeys = () => windows.size;
