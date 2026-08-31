"use client";

import { useEffect } from "react";

import type { ViewKind } from "@/lib/view-tracking";

/**
 * Fires one view beacon per page-load for a public link. Sends only the
 * browser's timezone, language and referrer host; the server adds a coarse
 * country (if the CDN provides one) and a rotating visitor hash.
 */
export function ViewBeacon({ kind, target }: { kind: ViewKind; target: string }) {
  useEffect(() => {
    const key = `fc_beacon_${kind}_${target}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — still send once */
    }
    let tz: string | null = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      /* ignore */
    }
    const payload = JSON.stringify({
      kind,
      target,
      tz,
      lang: navigator.language,
      ref: document.referrer || null,
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      } else {
        void fetch("/api/track", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      /* ignore */
    }
  }, [kind, target]);

  return null;
}
