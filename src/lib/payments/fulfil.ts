import { CreditReason, EngagementStatus, PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { logActivity } from "@/lib/activity";
import { KEEPER_PLAN } from "@/lib/pricing";
import { emitEvent } from "@/lib/webhooks";
import { notifyWorkspaceOwners } from "@/lib/notify";
import { resumeAwaitingGenerations } from "@/lib/generation/resume";

/**
 * Mark a payment PAID and run everything downstream (credits / Family plan /
 * deep search / research engagement, activity, notification, webhook).
 * Idempotent — a no-op if the payment is already PAID.
 *
 * Called both by the admin "approve" action and by the Daraja STK callback.
 */
export async function fulfilPayment(
  paymentId: string,
  opts: { verifiedById?: string | null; note?: string; providerRef?: string | null } = {},
): Promise<{ ok: boolean; alreadyPaid?: boolean }> {
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
  if (!payment) return { ok: false };
  if (payment.status === PaymentStatus.PAID) return { ok: true, alreadyPaid: true };

  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.PAID,
      verifiedById: opts.verifiedById ?? null,
      verifiedAt: new Date(),
      ...(opts.providerRef ? { providerRef: opts.providerRef, mpesaCode: opts.providerRef } : {}),
    },
  });

  const treeId = payment.treeId ?? payment.generationJob?.treeId ?? null;
  let summary = opts.note ?? "payment verified";

  if (payment.kind === PaymentKind.KEEPER && treeId) {
    const tree = await db.tree.findUnique({ where: { id: treeId }, select: { keeperUntil: true } });
    const from =
      tree?.keeperUntil && tree.keeperUntil.getTime() > Date.now() ? tree.keeperUntil : new Date();
    const until = new Date(from);
    until.setMonth(until.getMonth() + KEEPER_PLAN.months);
    await db.tree.update({ where: { id: treeId }, data: { keeperUntil: until } });
    summary = `Family plan active until ${until.toISOString().slice(0, 10)}`;
  } else if (payment.kind === PaymentKind.DEEP_SEARCH) {
    await db.deepSearch.updateMany({ where: { paymentId: payment.id }, data: { status: "PAID" } });
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
      actorId: opts.verifiedById ?? undefined,
      note: opts.note ?? "M-Pesa payment",
    });
    summary = `${payment.creditsGranted} credits added`;
  }

  // Credit bundle or Family plan just cleared → push any parked generations
  // straight to the clean render (no second "unlock" click).
  if (payment.kind === PaymentKind.KEEPER || payment.creditsGranted > 0) {
    await resumeAwaitingGenerations(payment.workspaceId, opts.verifiedById ?? null);
  }

  if (treeId) {
    await logActivity({
      treeId,
      actorId: opts.verifiedById ?? null,
      verb: "verified",
      objectType: "payment",
      objectId: payment.id,
      summary,
    });
  }
  await notifyWorkspaceOwners(payment.workspaceId, {
    kind: "payment.verified",
    title: "Payment received",
    body: summary,
    linkPath: treeId ? `/trees/${treeId}` : "/app",
    treeId,
  });
  await emitEvent(
    payment.workspaceId,
    "payment.verified",
    { paymentId: payment.id, kind: payment.kind, creditsGranted: payment.creditsGranted, summary },
    { treeId },
  );

  return { ok: true };
}
