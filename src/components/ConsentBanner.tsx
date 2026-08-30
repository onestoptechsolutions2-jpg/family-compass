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

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border p-4 text-sm shadow-lg"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <p>
        We use essential storage to run the site. Optional analytics storage helps us improve
        the research project — your choice. See our{" "}
        <a href="/policies/privacy" className="text-brand-600 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => set("all")}
          className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
        >
          Accept all
        </button>
        <button
          onClick={() => set("essential")}
          className="rounded-lg border px-3 py-1.5 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          Essential only
        </button>
      </div>
    </div>
  );
}
