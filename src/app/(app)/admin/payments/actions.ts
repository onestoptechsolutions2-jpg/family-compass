"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { fulfilPayment } from "@/lib/payments/fulfil";

export async function approvePayment(paymentId: string) {
  const admin = await requirePlatformAdmin();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) return;
  if (
    payment.status !== PaymentStatus.AWAITING_VERIFICATION &&
    payment.status !== PaymentStatus.AWAITING_STK
  ) {
    throw new Error("Only payments awaiting verification can be approved");
  }

  await fulfilPayment(paymentId, { verifiedById: admin.id, note: "verified by admin" });
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
