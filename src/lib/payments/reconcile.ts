import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { fulfilPayment } from "@/lib/payments/fulfil";
import { stkQuery } from "@/lib/payments/daraja";

/** How long Safaricom gets to send its callback before we ask it ourselves. */
export const STK_GRACE_MS = 60_000;
/** After this, a prompt that never answered is left for a person, not asked about again. */
export const STK_GIVE_UP_MS = 24 * 3600_000;

/**
 * Ask M-Pesa how an STK prompt ended, and settle the payment the same way its callback would.
 * Safe alongside the callback: fulfilment claims the payment in one conditional write, and a
 * failure is only recorded while the payment is still waiting on its prompt.
 * Returns what happened: "paid", "failed", or "pending" (no answer yet).
 */
export async function settleStk(paymentId: string): Promise<"paid" | "failed" | "pending"> {
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { status: true, checkoutRequestId: true } });
  if (!p) return "pending";
  if (p.status === PaymentStatus.PAID) return "paid";
  if (p.status !== PaymentStatus.AWAITING_STK || !p.checkoutRequestId) return "pending";
  const q = await stkQuery(p.checkoutRequestId);
  if (q.pending) return "pending";
  if (q.resultCode === 0) {
    await fulfilPayment(paymentId, { note: "M-Pesa STK (query)" });
    return "paid";
  }
  await db.payment.updateMany({
    where: { id: paymentId, status: PaymentStatus.AWAITING_STK, checkoutRequestId: p.checkoutRequestId },
    data: {
      status: PaymentStatus.REJECTED,
      resultCode: q.resultCode,
      resultDesc: q.resultDesc,
      rejectionReason: q.resultDesc || "Payment not completed",
    },
  });
  return "failed";
}

/**
 * The background sweep: every STK prompt still waiting after its grace period is asked about,
 * so a callback Safaricom never delivered cannot leave an order stuck. One failing query never
 * stops the rest.
 */
export async function reconcileStkPayments(now: Date = new Date()): Promise<{ checked: number; paid: number; failed: number }> {
  const waiting = await db.payment.findMany({
    where: {
      status: PaymentStatus.AWAITING_STK,
      checkoutRequestId: { not: null },
      updatedAt: { lt: new Date(now.getTime() - STK_GRACE_MS), gt: new Date(now.getTime() - STK_GIVE_UP_MS) },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: { id: true },
  });
  let paid = 0;
  let failed = 0;
  for (const { id } of waiting) {
    try {
      const r = await settleStk(id);
      if (r === "paid") paid++;
      if (r === "failed") failed++;
    } catch (err) {
      console.error("[reconcile] could not check payment", id, err);
    }
  }
  return { checked: waiting.length, paid, failed };
}
