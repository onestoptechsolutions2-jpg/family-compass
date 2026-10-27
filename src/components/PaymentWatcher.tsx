"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the pay page up to date by itself: while the payment waits on the customer's M-Pesa
 * PIN (or on us checking a code), it asks where things stand and reloads the page the moment
 * they change. Nothing to tap. It stops after a while, when the tab is hidden it pauses.
 */
export function PaymentWatcher({ paymentId, status }: { paymentId: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    // a PIN prompt settles in seconds; a code a person checks can take longer
    const every = status === "AWAITING_STK" ? 4000 : 15000;
    const until = Date.now() + (status === "AWAITING_STK" ? 5 : 30) * 60_000;
    let stopped = false;
    const tick = async () => {
      if (stopped || Date.now() > until) return;
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/payments/${paymentId}/status`, { cache: "no-store" });
          const j = (await res.json()) as { status?: string };
          if (j.status && j.status !== status) {
            router.refresh();
            return;
          }
        } catch {
          /* offline for a moment: try again on the next tick */
        }
      }
      if (!stopped) timer = setTimeout(tick, every);
    };
    let timer = setTimeout(tick, every);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paymentId, status, router]);
  return null;
}
