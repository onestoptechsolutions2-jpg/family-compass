"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GenerationKind, PaymentKind, PaymentStatus, CreditReason } from "@prisma/client";

import { db } from "@/lib/db";
import { requireTreeEdit, requireTreeManage } from "@/lib/rbac";
import { spendCredit, grantCredits } from "@/lib/credits";
import { logActivity } from "@/lib/activity";
import { paymentReference } from "@/lib/slug";
import { enqueue, QUEUE } from "@/lib/queue";
import { BUNDLES, GENERATION_NEEDS_CENTRAL } from "@/lib/pricing";
import { getPaymentSettings } from "@/lib/payments";

const createSchema = z.object({
  kind: z.enum(GenerationKind),
  centralPersonId: z.string().optional().default(""),
  generations: z.coerce.number().int().min(2).max(6).default(4),
  title: z.string().trim().max(120).optional(),
});

export async function createGeneration(treeId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = createSchema.parse(Object.fromEntries(formData));

  let centralPersonId: string | null = null;
  if (GENERATION_NEEDS_CENTRAL[d.kind]) {
    centralPersonId = d.centralPersonId || ctx.tree.homePersonId || null;
    if (!centralPersonId) throw new Error("Choose a central person for this chart");
    const p = await db.person.findFirst({
      where: { id: centralPersonId, treeId },
      select: { id: true },
    });
    if (!p) throw new Error("Central person is not in this tree");
  }

  const settings = await getPaymentSettings();

  const job = await db.generationJob.create({
    data: {
      treeId,
      requestedById: ctx.user.id,
      kind: d.kind,
      status: "QUEUED",
      params: { generations: d.generations, title: d.title ?? null },
      centralPersonId,
      priceKes: settings.defaultPriceKes,
    },
    select: { id: true },
  });

  await enqueue(QUEUE.renderPreview, { generationJobId: job.id });
  revalidatePath(`/trees/${treeId}/charts`);
}

/** Consume a free/credit unlock, or move the job to AWAITING_PAYMENT. */
export async function unlockGeneration(treeId: string, jobId: string) {
  const ctx = await requireTreeEdit(treeId);
  const job = await db.generationJob.findFirst({
    where: { id: jobId, treeId },
    select: { id: true, status: true, tree: { select: { freeExportUsedAt: true } } },
  });
  if (!job) throw new Error("Generation not found");
  if (job.status === "OUTPUT_READY" || job.status === "RENDERING_OUTPUT" || job.status === "PAID") {
    return;
  }
  if (job.status !== "PREVIEW_READY" && job.status !== "AWAITING_PAYMENT") {
    throw new Error("Preview is not ready yet");
  }

  // 1) first export on this tree is free
  if (!job.tree.freeExportUsedAt) {
    await db.$transaction([
      db.tree.update({ where: { id: treeId }, data: { freeExportUsedAt: new Date() } }),
      db.generationJob.update({
        where: { id: jobId },
        data: { status: "PAID", freeUnlock: true, unlockedAt: new Date() },
      }),
    ]);
    await grantCredits(ctx.workspace.id, 0, {
      reason: CreditReason.FREE,
      generationJobId: jobId,
      actorId: ctx.user.id,
      note: "First export free",
    }).catch(() => {});
    await enqueue(QUEUE.renderOutput, { generationJobId: jobId });
    revalidatePath(`/trees/${treeId}/charts`);
    return;
  }

  // 2) spend a credit if the workspace has one
  const spent = await spendCredit(ctx.workspace.id, jobId, ctx.user.id);
  if (spent) {
    await db.generationJob.update({
      where: { id: jobId },
      data: { status: "PAID", unlockedAt: new Date() },
    });
    await enqueue(QUEUE.renderOutput, { generationJobId: jobId });
    revalidatePath(`/trees/${treeId}/charts`);
    return;
  }

  // 3) needs payment
  await db.generationJob.update({ where: { id: jobId }, data: { status: "AWAITING_PAYMENT" } });
  revalidatePath(`/trees/${treeId}/charts`);
}

const buySchema = z.object({ kind: z.enum([PaymentKind.SINGLE, PaymentKind.BUNDLE_5, PaymentKind.BUNDLE_15]) });

export async function startCreditPurchase(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const { kind } = buySchema.parse(Object.fromEntries(formData));
  const bundle = BUNDLES[kind];
  const settings = await getPaymentSettings();
  const amountKes = kind === PaymentKind.SINGLE ? settings.defaultPriceKes : bundle.priceKes;

  await db.payment.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      provider: settings.provider,
      kind,
      creditsGranted: bundle.credits,
      amountKes,
      currency: settings.currency,
      reference: paymentReference(),
      status: PaymentStatus.PENDING,
    },
  });
  revalidatePath(`/trees/${treeId}/charts`);
}

export async function submitMpesaCode(treeId: string, paymentId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const code = String(formData.get("mpesaCode") ?? "").trim().toUpperCase();
  const phone = String(formData.get("payerPhone") ?? "").trim();
  if (code.length < 6) throw new Error("Enter the M-Pesa confirmation code");

  const payment = await db.payment.findFirst({
    where: { id: paymentId, workspaceId: ctx.workspace.id },
    select: { id: true, status: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.REJECTED) {
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
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "submitted",
    objectType: "payment",
    objectId: paymentId,
    summary: "submitted an M-Pesa payment for verification",
  });
  revalidatePath(`/trees/${treeId}/charts`);
}

export async function cancelPayment(treeId: string, paymentId: string) {
  const ctx = await requireTreeManage(treeId);
  const payment = await db.payment.findFirst({
    where: { id: paymentId, workspaceId: ctx.workspace.id },
    select: { id: true, status: true },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) throw new Error("Paid payments cannot be cancelled");
  await db.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.CANCELLED } });
  revalidatePath(`/trees/${treeId}/charts`);
}
