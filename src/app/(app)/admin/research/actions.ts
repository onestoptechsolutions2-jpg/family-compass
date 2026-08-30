"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EngagementStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";

export async function quoteEngagement(id: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const quotedKes = z.coerce.number().int().min(1).max(100_000_000).parse(formData.get("quotedKes"));
  const quoteNote = String(formData.get("quoteNote") ?? "").trim() || null;
  const eng = await db.researchEngagement.findUnique({ where: { id }, select: { status: true } });
  if (!eng) throw new Error("Not found");
  if (["ACTIVE", "DELIVERED", "CLOSED"].includes(eng.status)) throw new Error("Already in progress");
  await db.researchEngagement.update({
    where: { id },
    data: { quotedKes, quoteNote, status: EngagementStatus.QUOTED, assignedToId: admin.id },
  });
  revalidatePath("/admin/research");
}

export async function deliverEngagement(id: string, formData: FormData) {
  await requirePlatformAdmin();
  const deliverableUrl = String(formData.get("deliverableUrl") ?? "").trim() || null;
  const deliveryNote = String(formData.get("deliveryNote") ?? "").trim() || null;
  await db.researchEngagement.update({
    where: { id },
    data: { deliverableUrl, deliveryNote, status: EngagementStatus.DELIVERED },
  });
  revalidatePath("/admin/research");
}

export async function setEngagementStatus(id: string, status: EngagementStatus) {
  await requirePlatformAdmin();
  await db.researchEngagement.update({ where: { id }, data: { status } });
  revalidatePath("/admin/research");
}
