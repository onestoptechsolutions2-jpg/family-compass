import { headers } from "next/headers";

import { env } from "@/lib/env";

const LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * The best public origin for building links that a person will receive
 * (share pages, memorials, invites, WhatsApp sign-in). Resolution order:
 *
 *   1. SHARE_ORIGIN            — explicit override for outbound links
 *   2. the live request host   — if it isn't localhost (correct behind a proxy,
 *                                and self-heals when APP_URL is stale)
 *   3. APP_URL                 — if it isn't localhost
 *   4. the live request host   — even if local (normal local dev)
 *   5. APP_URL / hard fallback
 *
 * Safe to call outside a request (seed scripts): it just skips the header step.
 */
export async function publicOrigin(): Promise<string> {
  const share = (env.SHARE_ORIGIN || "").replace(/\/+$/, "");
  if (share) return share;

  const appUrl = (env.APP_URL || "").replace(/\/+$/, "");
  const appUrlIsReal = !!appUrl && !LOCAL.test(hostOf(appUrl) ?? "localhost");

  let requestOrigin: string | null = null;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (LOCAL.test(host) ? "http" : "https");
      requestOrigin = `${proto}://${host}`;
    }
  } catch {
    // not within a request scope
  }

  if (requestOrigin && !LOCAL.test(hostOf(requestOrigin) ?? "localhost")) return requestOrigin;
  if (appUrlIsReal) return appUrl;
  if (requestOrigin) return requestOrigin;
  return appUrl || "http://localhost:3000";
}

/** Build an absolute URL onto the public origin. `path` should start with "/". */
export async function absoluteUrl(path: string): Promise<string> {
  const origin = await publicOrigin();
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
