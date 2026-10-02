/**
 * Tiny, dependency-free User-Agent summariser. Good enough to tell one
 * device/browser apart from another in a "your sign-ins" list — not a full
 * UA database.
 */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const s = ua;

  const browser =
    /\bEdg(?:A|iOS)?\//.test(s) ? "Edge" :
    /\bOPR\/|\bOpera\b/.test(s) ? "Opera" :
    /\bFirefox\/|\bFxiOS\//.test(s) ? "Firefox" :
    /\bChrome\/|\bCriOS\//.test(s) && !/\bEdg\//.test(s) ? "Chrome" :
    /\bSafari\//.test(s) && /\bVersion\//.test(s) ? "Safari" :
    /\bSamsungBrowser\//.test(s) ? "Samsung Internet" :
    /\bMSIE |\bTrident\//.test(s) ? "Internet Explorer" :
    null;

  const os =
    /\bWindows NT 10/.test(s) ? "Windows" :
    /\bWindows NT/.test(s) ? "Windows" :
    /\biPhone\b/.test(s) ? "iPhone" :
    /\biPad\b/.test(s) ? "iPad" :
    /\bAndroid\b/.test(s) ? "Android" :
    /\bMac OS X\b|\bMacintosh\b/.test(s) ? "macOS" :
    /\bCrOS\b/.test(s) ? "ChromeOS" :
    /\bLinux\b/.test(s) ? "Linux" :
    null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return s.slice(0, 60);
}

/**
 * How many reverse proxies sit in front of the app and append the address they saw to
 * X-Forwarded-For. One (Coolify's) by default. Zero means the header is not trusted at all.
 */
function trustedHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}

/**
 * The client's address from an X-Forwarded-For header, or null.
 *
 * Each proxy appends the address it received the request from, so the entries on the LEFT are
 * whatever the client chose to claim and must never be trusted: a client sending
 * `X-Forwarded-For: 1.2.3.4` is seen by the proxy as `1.2.3.4, <real address>`. Take the entry
 * the last trusted proxy added, `hops` from the right.
 */
export function clientIp(fwd: string | null | undefined, hops: number = trustedHops()): string | null {
  if (hops === 0) return null;
  const parts = (fwd ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[Math.max(0, parts.length - hops)] ?? null;
}

/** Best-effort client IP from a request's headers, for rate limits and audit trails. */
export function clientIpFromHeaders(h: Headers): string | null {
  return clientIp(h.get("x-forwarded-for")) ?? (trustedHops() > 0 ? h.get("x-real-ip") : null) ?? null;
}

/**
 * Coarse device bucket for analytics + bot filtering: "bot" | "mobile" |
 * "tablet" | "desktop" | "unknown". Distinct from describeDevice(), which
 * produces a fine-grained human label ("Chrome on Android") for the sign-ins
 * list — this one is deliberately lossy so it aggregates well.
 */
export function deviceKind(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (/bot|crawl|spider|slurp|facebookexternalhit|WhatsApp|Twitterbot|Preview/i.test(s)) return "bot";
  if (/iPad|Tablet/i.test(s)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(s)) return "mobile";
  if (!s) return "unknown";
  return "desktop";
}
