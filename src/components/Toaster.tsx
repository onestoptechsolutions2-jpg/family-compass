"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Flash, FlashType } from "@/lib/flash-types";

type Toast = { id: string; type: FlashType; message: string };

const ICON: Record<FlashType, string> = { success: "✓", error: "✕", info: "i" };
const ACCENT: Record<FlashType, string> = {
  success: "var(--success, #16a34a)",
  error: "var(--danger, #dc2626)",
  info: "var(--accent, #2563eb)",
};
const LIFETIME_MS = 4500;

/**
 * App-wide toast host. Mounted once in the app layout. Shows:
 *  - server-queued flashes (the `flash` prop, set via setFlash() in an action)
 *  - client events: window.dispatchEvent(new CustomEvent("fc:toast",
 *    { detail: { type, message } }))
 */
export function Toaster({ flash }: { flash: Flash | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const h = timers.current[id];
    if (h) {
      clearTimeout(h);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (t: Toast) => {
      if (seen.current.has(t.id)) return;
      seen.current.add(t.id);
      setToasts((list) => [...list.slice(-3), t]);
      timers.current[t.id] = setTimeout(() => dismiss(t.id), LIFETIME_MS);
    },
    [dismiss],
  );

  // server-queued flash: fires whenever the layout re-renders with a new id
  useEffect(() => {
    if (!flash) return;
    push(flash);
    // clear the cookie so a later unrelated navigation doesn't replay it
    document.cookie = "fc_flash=; Max-Age=0; path=/";
  }, [flash, push]);

  // client-fired toasts
  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as { type?: FlashType; message?: string } | undefined;
      if (!d?.message) return;
      push({ id: Math.random().toString(36).slice(2, 10), type: d.type ?? "info", message: d.message });
    };
    window.addEventListener("fc:toast", onToast);
    return () => window.removeEventListener("fc:toast", onToast);
  }, [push]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg"
          style={{
            borderColor: "var(--border)",
            background: "var(--elevated, var(--surface))",
            borderLeft: `3px solid ${ACCENT[t.type]}`,
          }}
        >
          <span
            className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{ background: ACCENT[t.type] }}
            aria-hidden
          >
            {ICON[t.type]}
          </span>
          <span className="min-w-0 flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-xs hover:opacity-70"
            style={{ color: "var(--muted)" }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** Fire a toast from any client component. */
export function toast(type: FlashType, message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fc:toast", { detail: { type, message } }));
  }
}
