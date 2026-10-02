"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { getPaymentSettings } from "@/lib/payments";
import { fulfilPayment } from "@/lib/payments/fulfil";
import { stkPush, stkQuery, mpesaMsisdn, darajaConfigured, DARAJA_PROVIDER_ID } from "@/lib/payments/daraja";
import { emitEvent } from "@/lib/webhooks";
import { notifyPlatformAdmins } from "@/lib/notify";
import { codeUsedElsewhere, normaliseCode } from "@/lib/payments/verification";

const KIND_DESC: Record<string, string> = {
  SINGLE: "Family Compass credit",
  BUNDLE_5: "Family Compass credits x5",
  BUNDLE_15: "Family Compass credits x15",
  KEEPER: "Family Compass Family plan",
  DEEP_SEARCH: "Family Compass deep search",
  RESEARCH_PARTNER: "Family Compass research",
  MEMORIAL_PASS: "Family Compass Memorial Pass",
  ORDER_DEPOSIT: "Family Compass order deposit",
  ORDER_BALANCE: "Family Compass order balance",
};

async function ownPayment(paymentId: string) {
  const me = await requireUser();
  const payment = await db.payment.findFirst({
    where: { id: paymentId, userId: me.id },
    select: {
      id: true,
      status: true,
      kind: true,
      amountKes: true,
      reference: true,
      checkoutRequestId: true,
      workspaceId: true,
      treeId: true,
    },
  });
  if (!payment) throw new Error("Payment not found");
  return payment;
}

const OPEN: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.REJECTED, PaymentStatus.AWAITING_STK];

/** Send a Safaricom STK Push prompt to the customer's phone. */
export async function startStkPush(paymentId: string, formData: FormData) {
  const p = await ownPayment(paymentId);
  if (!OPEN.includes(p.status)) throw new Error("This payment can no longer be updated");

  const settings = await getPaymentSettings();
  if (settings.provider !== DARAJA_PROVIDER_ID || !darajaConfigured) {
    throw new Error("M-Pesa STK is not available — pay to the Till and paste the code instead.");
  }

  const msisdn = mpesaMsisdn(String(formData.get("phone") ?? ""));
  if (!msisdn) throw new Error("Enter a valid Safaricom number (07… or 2547…)");

  const origin = await publicOrigin();
  const r = await stkPush({
    amountKes: p.amountKes,
    phone: msisdn,
    reference: p.reference,
    description: KIND_DESC[p.kind] ?? "Family Compass",
    callbackUrl: `${origin}/api/payments/webhook/${DARAJA_PROVIDER_ID}`,
  });

  await db.payment.update({
    where: { id: paymentId },
    data: {
      checkoutRequestId: r.checkoutRequestId,
      merchantRequestId: r.merchantRequestId,
      payerPhone: msisdn,
      status: PaymentStatus.AWAITING_STK,
      rejectionReason: null,
      resultCode: null,
      resultDesc: null,
    },
  });
  revalidatePath(`/pay/${paymentId}`);
}

/** Re-check an STK payment (fallback for a missed callback). */
export async function pollStk(paymentId: string) {
  const p = await ownPayment(paymentId);
  if (p.status === PaymentStatus.PAID || !p.checkoutRequestId) {
    revalidatePath(`/pay/${paymentId}`);
    return;
  }
  const q = await stkQuery(p.checkoutRequestId);
  if (!q.pending) {
    if (q.resultCode === 0) {
      await fulfilPayment(paymentId, { note: "M-Pesa STK (query)" });
    } else {
      await db.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REJECTED,
          resultCode: q.resultCode,
          resultDesc: q.resultDesc,
          rejectionReason: q.resultDesc || "Payment not completed",
        },
      });
    }
  }
  revalidatePath(`/pay/${paymentId}`);
}

export async function submitPaymentCode(paymentId: string, formData: FormData) {
  const p = await ownPayment(paymentId);
  const code = normaliseCode(String(formData.get("mpesaCode") ?? ""));
  const phone = String(formData.get("payerPhone") ?? "").trim().slice(0, 40);
  if (!code) throw new Error("Enter the M-Pesa confirmation code: letters and numbers, as in the message M-Pesa sent you.");
  // one real payment cannot pay for two orders
  if (await codeUsedElsewhere(code, paymentId)) {
    throw new Error("That confirmation code has already been used for another payment. Check it, or contact us if you think this is a mistake.");
  }
  if (!OPEN.includes(p.status) && p.status !== PaymentStatus.AWAITING_STK) {
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
  await emitEvent(
    p.workspaceId,
    "payment.recorded",
    { paymentId, reference: p.reference, kind: p.kind, amountKes: p.amountKes },
    { treeId: p.treeId },
  );
  // Money is waiting on a person: tell the admins now, not when they next look.
  await notifyPlatformAdmins({
    kind: "payment.recorded",
    title: "Payment to verify",
    body: `KES ${p.amountKes.toLocaleString()} · ${p.kind.replace(/_/g, " ").toLowerCase()} · code ${code}`,
    linkPath: "/admin/payments",
  });
  revalidatePath(`/pay/${paymentId}`);
}

export async function cancelPaymentById(paymentId: string) {
  const p = await ownPayment(paymentId);
  if (p.status === PaymentStatus.PAID) throw new Error("Paid payments cannot be cancelled");
  await db.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.CANCELLED } });
  redirect("/app");
}
