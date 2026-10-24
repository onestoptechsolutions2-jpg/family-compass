"use client";

import { useEffect, useState } from "react";

const KEY = "fc_consent_v2";

type Choice = "essential" | "all";

function read(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "essential" || v === "all" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Minimal consent banner (Consent Mode v2 style): essential storage is always
 * on; analytics/marketing storage only after "Accept all". The choice is kept
 * per-browser and exposed on window.__fcConsent for any future scripts.
 */
export function ConsentBanner() {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined);

  useEffect(() => {
    const c = read();
    setChoice(c);
    (window as unknown as { __fcConsent?: string }).__fcConsent = c ?? "essential";
  }, []);

  const set = (c: Choice) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
    (window as unknown as { __fcConsent?: string }).__fcConsent = c;
    setChoice(c);
  };

  if (choice === undefined || choice !== null) return null;

  // A thin bar at the top, so it never sits over the button someone is about to tap.
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center gap-2 border-b px-3 py-2 text-xs shadow-sm"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <p className="min-w-0 flex-1">
        Optional analytics?{" "}
        <a href="/policies/privacy" className="underline">Privacy</a>
      </p>
      <button onClick={() => set("essential")} className="rounded-md border px-2.5 py-1 font-medium" style={{ borderColor: "var(--border)" }}>
        No thanks
      </button>
      <button onClick={() => set("all")} className="rounded-md bg-brand-600 px-2.5 py-1 font-medium text-white hover:bg-brand-700">
        Allow
      </button>
    </div>
  );
}
