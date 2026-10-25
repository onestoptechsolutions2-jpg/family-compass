"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const KEY = "fc_consent_v2";

/** Where a family is ordering or paying: nothing extra on screen there. Analytics stays off until asked. */
const QUIET = /^\/(order|pay|start|start-order|give|cart|login)(\/|$)/;

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
  const path = usePathname();

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

  if (choice === undefined || choice !== null || QUIET.test(path ?? "")) return null;

  // A thin bar above the page, not over it: it pushes the page down, so it never hides the
  // header, a question or the button someone is about to tap.
  return (
    <div
      className="relative z-50 flex items-center gap-2 border-b px-3 py-2 text-xs shadow-sm"
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
