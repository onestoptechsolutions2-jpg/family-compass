import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Checks that stand between a customer's claim ("I paid, here is the code") and the shop
 * releasing work. Money is confirmed by a person reading an M-Pesa statement, so these exist
 * to catch the ways that goes wrong: a mistyped code, a code reused for a second order, and a
 * payment that arrived short.
 */

/** M-Pesa confirmation codes are ten letters and digits; bank references are a little longer. */
const CODE = /^[A-Z0-9]{6,20}$/;

/** A code as the statement shows it: capitals, no spaces. Null when it cannot be one. */
export function normaliseCode(raw: string): string | null {
  const c = raw.replace(/[\s-]+/g, "").toUpperCase();
  return CODE.test(c) ? c : null;
}

/** Another payment that already claims this code, so one real transaction cannot pay for two orders. */
export async function codeUsedElsewhere(
  code: string,
  paymentId: string,
  statuses: PaymentStatus[] = [PaymentStatus.AWAITING_VERIFICATION, PaymentStatus.PAID],
): Promise<{ reference: string; status: PaymentStatus } | null> {
  const other = await db.payment.findFirst({
    where: { mpesaCode: code, id: { not: paymentId }, status: { in: statuses } },
    select: { reference: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  return other;
}

/** Whether what arrived covers what was due. Paying more is recorded, not refused. */
export function coversDue(dueKes: number, receivedKes: number): { ok: true } | { ok: false; shortBy: number } {
  return receivedKes >= dueKes ? { ok: true } : { ok: false, shortBy: dueKes - receivedKes };
}

/** A whole number of shillings from a form field, or null. */
export function wholeKes(raw: FormDataEntryValue | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/[,\s]/g, "").replace(/^KES/i, "");
  if (!/^\d{1,9}$/.test(s)) return null;
  return Number(s);
}
