"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CreditReason, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { grantCredits } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

export async function approvePayment(paymentId: string) {
  const admin = await requirePlatformAdmin();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      workspaceId: true,
      creditsGranted: true,
      generationJobId: true,
      generationJob: { select: { treeId: true } },
    },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) return;
  if (payment.status !== PaymentStatus.AWAITING_VERIFICATION) {
    throw new Error("Only payments awaiting verification can be approved");
  }

  await db.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.PAID, verifiedById: admin.id, verifiedAt: new Date() },
  });
  if (payment.creditsGranted > 0) {
    await grantCredits(payment.workspaceId, payment.creditsGranted, {
      reason: CreditReason.PURCHASE,
      paymentId: payment.id,
      actorId: admin.id,
      note: "M-Pesa payment verified",
    });
  }
  if (payment.generationJob?.treeId) {
    await logActivity({
      treeId: payment.generationJob.treeId,
      actorId: admin.id,
      verb: "verified",
      objectType: "payment",
      objectId: payment.id,
      summary: `payment verified — ${payment.creditsGranted} credits added`,
    });
  }

  revalidatePath("/admin/payments");
}

export async function rejectPayment(paymentId: string, formData: FormData) {
  await requirePlatformAdmin();
  const reason = z.string().trim().min(1).max(300).parse(formData.get("reason"));
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) throw new Error("Paid payments cannot be rejected");

  await db.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.REJECTED, rejectionReason: reason },
  });
  revalidatePath("/admin/payments");
}
