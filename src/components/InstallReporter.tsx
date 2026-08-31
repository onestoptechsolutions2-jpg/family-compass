"use client";

import { useEffect } from "react";

const REPORTED_KEY = "fc_install_reported";

/**
 * Silent. When the signed-in app is running as an installed PWA (standalone
 * display-mode) — or the browser fires `appinstalled` — tell the server once,
 * so admin can count installs per device. No UI.
 */
export function InstallReporter() {
  useEffect(() => {
    const report = () => {
      try {
        if (sessionStorage.getItem(REPORTED_KEY)) return;
        sessionStorage.setItem(REPORTED_KEY, "1");
      } catch {
        /* private mode — still worth one POST */
      }
      fetch("/api/session/installed", { method: "POST", keepalive: true }).catch(() => {});
    };

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only
      window.navigator.standalone === true;
    if (standalone) report();

    window.addEventListener("appinstalled", report);
    return () => window.removeEventListener("appinstalled", report);
  }, []);

  return null;
}
