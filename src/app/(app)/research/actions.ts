"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EngagementStatus, PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { personalWorkspaceId } from "@/lib/workspace";
import { getPaymentSettings } from "@/lib/payments";
import { paymentReference } from "@/lib/slug";

const requestSchema = z.object({
  subjectName: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(10).max(6000),
  community: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  generationsTarget: z.coerce.number().int().min(1).max(20).optional(),
  nodesTarget: z.coerce.number().int().min(1).max(100000).optional(),
});

export async function requestEngagement(formData: FormData) {
  const me = await requireUser();
  const d = requestSchema.parse(Object.fromEntries(formData));
  await db.researchEngagement.create({
    data: {
      requestedById: me.id,
      subjectName: d.subjectName,
      brief: d.brief,
      community: d.community || null,
      region: d.region || null,
      generationsTarget: d.generationsTarget ?? null,
      nodesTarget: d.nodesTarget ?? null,
      status: EngagementStatus.REQUESTED,
    },
  });
  revalidatePath("/research");
}

export async function payEngagement(engagementId: string) {
  const me = await requireUser();
  const eng = await db.researchEngagement.findFirst({
    where: { id: engagementId, requestedById: me.id },
    select: { id: true, status: true, quotedKes: true, paymentId: true },
  });
  if (!eng) throw new Error("Engagement not found");
  if (eng.paymentId) redirect(`/pay/${eng.paymentId}`);
  if (eng.status !== EngagementStatus.QUOTED || !eng.quotedKes) {
    throw new Error("This engagement doesn't have a quote yet");
  }
  const settings = await getPaymentSettings();
  const workspaceId = await personalWorkspaceId(me.id, me.name ?? me.email);
  const payment = await db.payment.create({
    data: {
      workspaceId,
      userId: me.id,
      provider: settings.provider,
      kind: PaymentKind.RESEARCH_PARTNER,
      creditsGranted: 0,
      amountKes: eng.quotedKes,
      currency: settings.currency,
      reference: paymentReference(),
      status: PaymentStatus.PENDING,
    },
    select: { id: true },
  });
  await db.researchEngagement.update({
    where: { id: engagementId },
    data: { paymentId: payment.id, status: EngagementStatus.AWAITING_PAYMENT },
  });
  redirect(`/pay/${payment.id}`);
}
