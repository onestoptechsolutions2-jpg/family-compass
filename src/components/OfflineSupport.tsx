"use client";

import { useEffect } from "react";

/**
 * Silent. Registers the service worker unconditionally (PushSetup only does
 * this once someone opts into notifications), so read-only offline viewing —
 * a profile or memorial you've already opened stays viewable with no signal —
 * works for every signed-in visitor, not just those who enabled push. No UI;
 * see public/sw.js for what actually gets cached.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
