import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Chama signs what it sends us (fund webhooks, bereavement referrals) as
 * X-Chama-Signature-256 = hex HMAC-SHA256 of "<X-Chama-Timestamp>.<raw body>".
 * A request is genuine only if the signature matches the raw bytes as received
 * and the timestamp is within five minutes, so a captured request cannot be replayed later.
 */
export const MAX_SKEW_SECONDS = 300;

export function signChama(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyChamaSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !timestamp || !signature || !/^\d{9,11}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(signChama(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature.trim().toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
