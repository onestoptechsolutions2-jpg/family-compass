"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireTreeManage } from "@/lib/rbac";
import { fetchChamaGroup } from "@/lib/chama-api";

const P = (treeId: string) => `/trees/${treeId}/chama`;

/** Link this tree to an external Chama group by its Developer API key. */
export async function linkChama(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const baseUrl = (String(formData.get("baseUrl") ?? "").trim() || "https://chama.laitor.co.ke").replace(/\/$/, "");
  if (!apiKey.startsWith("chama_")) redirect(`${P(treeId)}?err=key`);

  const group = await fetchChamaGroup({ baseUrl, apiKey });
  if (!group) redirect(`${P(treeId)}?err=validate`);

  await db.chamaLink.upsert({
    where: { treeId },
    create: {
      treeId,
      baseUrl,
      apiKey,
      groupId: group.id,
      groupName: group.name,
      groupType: group.type,
      currency: group.currency,
      webhookSecret: `whsec_${randomBytes(20).toString("hex")}`,
      createdById: ctx.user.id,
      lastSyncedAt: new Date(),
    },
    update: {
      baseUrl,
      apiKey,
      groupId: group.id,
      groupName: group.name,
      groupType: group.type,
      currency: group.currency,
      lastSyncedAt: new Date(),
      lastError: null,
    },
  });
  revalidatePath(P(treeId));
  redirect(`${P(treeId)}?ok=linked`);
}

export async function refreshChama(treeId: string) {
  await requireTreeManage(treeId);
  const link = await db.chamaLink.findUnique({ where: { treeId } });
  if (!link) redirect(P(treeId));
  const group = await fetchChamaGroup(link);
  await db.chamaLink.update({
    where: { treeId },
    data: group
      ? {
          groupId: group.id,
          groupName: group.name,
          groupType: group.type,
          currency: group.currency,
          lastSyncedAt: new Date(),
          lastError: null,
        }
      : { lastError: "group fetch failed — check the key" },
  });
  revalidatePath(P(treeId));
}

export async function setChamaPushWelfare(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  await db.chamaLink.update({
    where: { treeId },
    data: { pushWelfare: formData.get("on") === "1" },
  });
  revalidatePath(P(treeId));
}

export async function unlinkChama(treeId: string) {
  await requireTreeManage(treeId);
  await db.chamaLink.deleteMany({ where: { treeId } });
  revalidatePath(P(treeId));
  redirect(`${P(treeId)}?ok=unlinked`);
}
