import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";

/** Money given back is applied to the payments that took it, oldest first, never beyond what each took. */
export type RefundablePayment = { id: string; amountKes: number; refundedKes: number };

export function allocateRefund(payments: RefundablePayment[], refundKes: number): { id: string; add: number }[] {
  if (!Number.isInteger(refundKes) || refundKes < 0) throw new Error("A refund is a whole number of shillings, zero or more.");
  const room = payments.reduce((n, p) => n + Math.max(0, p.amountKes - p.refundedKes), 0);
  if (refundKes > room) throw new Error(`Only KES ${room.toLocaleString("en-KE")} can still be refunded on this order.`);
  let left = refundKes;
  const out: { id: string; add: number }[] = [];
  for (const p of payments) {
    if (left <= 0) break;
    const add = Math.min(left, Math.max(0, p.amountKes - p.refundedKes));
    if (add > 0) {
      out.push({ id: p.id, add });
      left -= add;
    }
  }
  return out;
}

/** What has been paid on an order and not yet given back. */
export async function refundableOn(orderId: string): Promise<{ paidKes: number; roomKes: number; payments: RefundablePayment[] }> {
  const rows = await db.payment.findMany({
    where: { orderId, status: PaymentStatus.PAID },
    orderBy: { createdAt: "asc" },
    select: { id: true, amountKes: true, refundedKes: true },
  });
  return {
    paidKes: rows.reduce((n, p) => n + p.amountKes, 0),
    roomKes: rows.reduce((n, p) => n + Math.max(0, p.amountKes - p.refundedKes), 0),
    payments: rows,
  };
}

/** Record a refund that has been paid (or is about to be) back to the customer. The admin pays it by M-Pesa; this is the book. */
export async function recordRefund(orderId: string, refundKes: number, note: string): Promise<void> {
  const { payments } = await refundableOn(orderId);
  const parts = allocateRefund(payments, refundKes);
  const now = new Date();
  await db.$transaction(
    parts.map((p) => db.payment.update({ where: { id: p.id }, data: { refundedKes: { increment: p.add }, refundedAt: now, refundNote: note.slice(0, 300) } })),
  );
}
