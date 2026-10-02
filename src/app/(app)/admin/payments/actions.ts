"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { fulfilPayment } from "@/lib/payments/fulfil";
import { writeAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/webhooks";
import { codeUsedElsewhere, coversDue, wholeKes } from "@/lib/payments/verification";

/**
 * Approve a payment after reading it on the M-Pesa statement. The amount that arrived is typed in
 * and must cover what was due; the code must not already have paid something else.
 */
export async function approvePayment(paymentId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true, amountKes: true, mpesaCode: true, currency: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) return;
  if (
    payment.status !== PaymentStatus.AWAITING_VERIFICATION &&
    payment.status !== PaymentStatus.AWAITING_STK
  ) {
    throw new Error("Only payments awaiting verification can be approved");
  }

  const received = wholeKes(formData.get("receivedKes"));
  if (received === null) throw new Error("Enter the amount you saw arrive, in whole shillings.");
  const covers = coversDue(payment.amountKes, received);
  if (!covers.ok) {
    throw new Error(`Only ${payment.currency} ${received.toLocaleString()} arrived but ${payment.currency} ${payment.amountKes.toLocaleString()} is due (short by ${covers.shortBy.toLocaleString()}). Reject it and ask for the rest.`);
  }
  if (payment.mpesaCode) {
    const used = await codeUsedElsewhere(payment.mpesaCode, paymentId, ["PAID"]);
    if (used) throw new Error(`This code already paid ${used.reference}. One payment cannot cover two orders. Reject it.`);
  }

  await fulfilPayment(paymentId, { verifiedById: admin.id, note: "verified by admin", receivedKes: received });
  await writeAudit({ actorId: admin.id, action: "payment.approve", targetType: "payment", targetId: paymentId, meta: { receivedKes: received, dueKes: payment.amountKes } });
  revalidatePath("/admin/payments");
}

export async function rejectPayment(paymentId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const reason = z.string().trim().min(1).max(300).parse(formData.get("reason"));
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true, workspaceId: true, treeId: true, reference: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) throw new Error("Paid payments cannot be rejected");

  await db.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.REJECTED, rejectionReason: reason },
  });
  await writeAudit({ actorId: admin.id, action: "payment.reject", targetType: "payment", targetId: paymentId, meta: { reason } });
  await emitEvent(
    payment.workspaceId,
    "payment.rejected",
    { paymentId, reference: payment.reference, reason },
    { treeId: payment.treeId },
  );
  revalidatePath("/admin/payments");
}
