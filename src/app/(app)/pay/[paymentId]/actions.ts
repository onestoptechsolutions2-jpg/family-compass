"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

async function ownPayment(paymentId: string) {
  const me = await requireUser();
  const payment = await db.payment.findFirst({
    where: { id: paymentId, userId: me.id },
    select: { id: true, status: true },
  });
  if (!payment) throw new Error("Payment not found");
  return payment;
}

export async function submitPaymentCode(paymentId: string, formData: FormData) {
  const p = await ownPayment(paymentId);
  const code = String(formData.get("mpesaCode") ?? "").trim().toUpperCase();
  const phone = String(formData.get("payerPhone") ?? "").trim();
  if (code.length < 6) throw new Error("Enter the M-Pesa confirmation code");
  if (p.status !== PaymentStatus.PENDING && p.status !== PaymentStatus.REJECTED) {
    throw new Error("This payment can no longer be updated");
  }
  await db.payment.update({
    where: { id: paymentId },
    data: {
      mpesaCode: code,
      payerPhone: phone || null,
      status: PaymentStatus.AWAITING_VERIFICATION,
      rejectionReason: null,
    },
  });
  revalidatePath(`/pay/${paymentId}`);
}

export async function cancelPaymentById(paymentId: string) {
  const p = await ownPayment(paymentId);
  if (p.status === PaymentStatus.PAID) throw new Error("Paid payments cannot be cancelled");
  await db.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.CANCELLED } });
  redirect("/app");
}
