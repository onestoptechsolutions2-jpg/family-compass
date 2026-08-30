"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fc_install_dismissed_v1";

/**
 * Nudges phone users to install the app. Uses the native `beforeinstallprompt`
 * on Android/Chrome; falls back to an "Add to Home Screen" hint on iOS Safari.
 * Self-hides once installed or dismissed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only
      window.navigator.standalone === true;
    if (standalone) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|crios|fxios).)*safari/i.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm rounded-2xl border p-4 shadow-lg sm:left-auto sm:right-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">🧭</span>
        <div className="flex-1 text-sm">
          <p className="font-medium">Install Family Compass</p>
          {iosHint ? (
            <p className="mt-1" style={{ color: "var(--muted)" }}>
              Tap the Share button, then <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="mt-1" style={{ color: "var(--muted)" }}>
              Add it to your phone for one-tap access, offline pages and updates.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {!iosHint && deferred && (
              <button
                onClick={async () => {
                  await deferred.prompt();
                  await deferred.userChoice.catch(() => {});
                  dismiss();
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
