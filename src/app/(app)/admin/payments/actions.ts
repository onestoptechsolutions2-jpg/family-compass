"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CreditReason, EngagementStatus, PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { grantCredits } from "@/lib/credits";
import { logActivity } from "@/lib/activity";
import { KEEPER_PLAN } from "@/lib/pricing";

export async function approvePayment(paymentId: string) {
  const admin = await requirePlatformAdmin();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      kind: true,
      workspaceId: true,
      treeId: true,
      creditsGranted: true,
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

  const treeId = payment.treeId ?? payment.generationJob?.treeId ?? null;
  let summary = "payment verified";

  if (payment.kind === PaymentKind.KEEPER && treeId) {
    const tree = await db.tree.findUnique({ where: { id: treeId }, select: { keeperUntil: true } });
    const from =
      tree?.keeperUntil && tree.keeperUntil.getTime() > Date.now() ? tree.keeperUntil : new Date();
    const until = new Date(from);
    until.setMonth(until.getMonth() + KEEPER_PLAN.months);
    await db.tree.update({ where: { id: treeId }, data: { keeperUntil: until } });
    summary = `Family plan verified — active until ${until.toISOString().slice(0, 10)}`;
  } else if (payment.kind === PaymentKind.DEEP_SEARCH) {
    await db.deepSearch.updateMany({
      where: { paymentId: payment.id },
      data: { status: "PAID" },
    });
    summary = "deep search unlocked";
  } else if (payment.kind === PaymentKind.RESEARCH_PARTNER) {
    await db.researchEngagement.updateMany({
      where: { paymentId: payment.id },
      data: { status: EngagementStatus.ACTIVE },
    });
    summary = "research engagement activated";
  } else if (payment.creditsGranted > 0) {
    await grantCredits(payment.workspaceId, payment.creditsGranted, {
      reason: CreditReason.PURCHASE,
      paymentId: payment.id,
      actorId: admin.id,
      note: "M-Pesa payment verified",
    });
    summary = `payment verified — ${payment.creditsGranted} credits added`;
  }

  if (treeId) {
    await logActivity({
      treeId,
      actorId: admin.id,
      verb: "verified",
      objectType: "payment",
      objectId: payment.id,
      summary,
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
