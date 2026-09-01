"use client";

import { useEffect, useState } from "react";

function urlBase64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

/**
 * Opt-in device (Web Push) notifications. Renders nothing unless the browser
 * can do push and the server has a VAPID key. `compact` is the inline variant
 * used inside the claimed-profile wizard.
 */
export function PushSetup({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState("unsupported");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/push/key");
        if (res.status !== 200) {
          setState("unsupported");
          return;
        }
        const { key: k } = await res.json();
        setKey(k);
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  const enable = async () => {
    if (!key) return;
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(key),
      });
      const json = sub.toJSON();
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState(r.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  };

  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } catch {
      setState("off");
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  const btn = "rounded-lg px-3 py-1.5 text-sm font-medium";

  if (compact) {
    if (state === "on") {
      return (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          🔔 Device notifications are on.{" "}
          <button onClick={disable} className="hover:underline" style={{ color: "var(--link)" }}>turn off</button>
        </p>
      );
    }
    if (state === "denied") {
      return (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Notifications are blocked in your browser settings for this site.
        </p>
      );
    }
    return (
      <button
        onClick={enable}
        disabled={state === "busy"}
        className="self-start text-xs hover:underline disabled:opacity-50"
        style={{ color: "var(--link)" }}
      >
        {state === "busy" ? "…" : "🔔 Turn on device notifications"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <h3 className="font-medium">Device notifications</h3>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Get a notification on this device when something happens on a profile you follow — works best
        with the app installed.
      </p>
      <div className="mt-3">
        {state === "on" ? (
          <button onClick={disable} className={btn} style={{ border: "1px solid var(--border)" }}>
            Turn off on this device
          </button>
        ) : state === "denied" ? (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Blocked in your browser settings — allow notifications for this site, then reload.
          </p>
        ) : (
          <button
            onClick={enable}
            disabled={state === "busy"}
            className={`${btn} bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50`}
          >
            {state === "busy" ? "Setting up…" : "Turn on for this device"}
          </button>
        )}
      </div>
    </div>
  );
}
