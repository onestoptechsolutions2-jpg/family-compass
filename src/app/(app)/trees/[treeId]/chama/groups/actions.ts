"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ChamaPurpose } from "@prisma/client";

import { db } from "@/lib/db";
import { loadTreeContext, requireTreeManage } from "@/lib/rbac";
import { displayName, NAME_SELECT } from "@/lib/person";
import { createChama, joinChama, leaveChama } from "@/lib/chama";
import { flashOk, flashErr } from "@/lib/flash";

const P = (treeId: string) => `/trees/${treeId}/chama/groups`;

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  purpose: z.enum(["WELFARE", "SAVINGS", "MERRY_GO_ROUND", "TABLE_BANKING"]),
});

/** Any tree manager can start a group — e.g. one scoped to a generation
 *  cohort suggested from the People page. */
export async function createChamaGroup(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    await flashErr("Give the group a name and purpose.");
    redirect(P(treeId));
  }
  await createChama(treeId, {
    workspaceId: ctx.workspace.id,
    name: parsed.data.name,
    purpose: parsed.data.purpose as ChamaPurpose,
    createdById: ctx.user.id,
  });
  await flashOk(`"${parsed.data.name}" created.`);
  revalidatePath(P(treeId));
  redirect(P(treeId));
}

/**
 * Joining is self-service: any signed-in member with a claimed profile in
 * this tree can join a group — registering yourself isn't editing anyone
 * else's record, so it doesn't need manager rights.
 */
export async function joinChamaGroup(treeId: string, chamaId: string) {
  const ctx = await loadTreeContext(treeId);
  const me = await db.person.findFirst({
    where: { treeId, claimedByUserId: ctx.user.id },
    select: { id: true, phone: true, names: { select: NAME_SELECT } },
  });
  if (!me) {
    await flashErr("Claim your profile in this tree first, then you can join a group.");
    redirect(P(treeId));
  }
  await joinChama(chamaId, me.id, { name: displayName(me.names), phone: me.phone });
  await flashOk("Joined.");
  revalidatePath(P(treeId));
}

export async function leaveChamaGroup(treeId: string, chamaId: string) {
  const ctx = await loadTreeContext(treeId);
  const me = await db.person.findFirst({
    where: { treeId, claimedByUserId: ctx.user.id },
    select: { id: true },
  });
  if (!me) redirect(P(treeId));
  await leaveChama(chamaId, me.id);
  revalidatePath(P(treeId));
}
