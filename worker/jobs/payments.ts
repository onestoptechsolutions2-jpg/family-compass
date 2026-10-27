import type { Job } from "pg-boss";

import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { reconcileStkPayments } from "@/lib/payments/reconcile";

/** Every two minutes: settle M-Pesa prompts whose callback never came. */
export async function handlePaymentReconcile(_jobs: Job<JobPayloads[typeof QUEUE.paymentReconcile]>[]) {
  const r = await reconcileStkPayments();
  if (r.checked) console.log("[worker] payment reconcile", r);
}
