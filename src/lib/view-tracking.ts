import { createHash } from "node:crypto";

export const VIEW_KINDS = ["share", "memorial", "give", "claim"] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export function isViewKind(v: string): v is ViewKind {
  return (VIEW_KINDS as readonly string[]).includes(v);
}

/** IANA tz -> a human "City · Continent" label. */
export function regionFromTimezone(tz: string | null | undefined): string | null {
  if (!tz || !tz.includes("/")) return tz ?? null;
  const parts = tz.split("/");
  const continent = parts[0]?.replace(/_/g, " ") ?? "";
  const city = parts[parts.length - 1]?.replace(/_/g, " ") ?? "";
  return city ? `${city} · ${continent}` : continent || null;
}

/** Country ISO-2 from whatever the CDN / proxy put on the request. */
export function countryFromHeaders(h: Headers): string | null {
  const raw =
    h.get("cf-ipcountry") ??
    h.get("x-vercel-ip-country") ??
    h.get("x-country-code") ??
    h.get("x-geo-country") ??
    null;
  if (!raw) return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

export function deviceKind(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (/bot|crawl|spider|slurp|facebookexternalhit|WhatsApp|Twitterbot|Preview/i.test(s)) return "bot";
  if (/iPad|Tablet/i.test(s)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(s)) return "mobile";
  if (!s) return "unknown";
  return "desktop";
}

/** Non-reversible per-day visitor hash — lets us count uniques without
 *  storing the address. Rotates automatically each UTC day. */
export function dailyIpHash(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 24);
}

export function referrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}
