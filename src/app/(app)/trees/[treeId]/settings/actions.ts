"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SHOWCASE_TAG } from "@/lib/queries/showcase";

import { db } from "@/lib/db";
import { requireTreeManage, loadTreeContext } from "@/lib/rbac";
import { canManageWorkspace } from "@/lib/rbac";

export async function renameTree(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
  const description = z.string().trim().max(2000).optional().parse(formData.get("description") ?? undefined);
  await db.tree.update({ where: { id: treeId }, data: { name, description: description || null } });
  revalidatePath(`/trees/${treeId}`);
}

export async function setHomePerson(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  const raw = String(formData.get("homePersonId") ?? "").trim();
  const homePersonId = raw || null;
  if (homePersonId) {
    const p = await db.person.findFirst({ where: { id: homePersonId, treeId }, select: { id: true } });
    if (!p) throw new Error("Person not in this tree");
  }
  await db.tree.update({ where: { id: treeId }, data: { homePersonId } });
  revalidatePath(`/trees/${treeId}/settings`);
}

const discoverySchema = z.object({
  discoverable: z.coerce.boolean().default(false),
  showcase: z.coerce.boolean().default(false),
  community: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
});

/** Set the tree's family admin — a workspace member who manages this tree
 *  (claims, sharing, requests) regardless of their workspace role. */
export async function setFamilyAdmin(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const raw = String(formData.get("adminUserId") ?? "").trim();
  const adminUserId = raw || null;
  if (adminUserId) {
    const member = await db.membership.findFirst({
      where: { userId: adminUserId, workspaceId: ctx.workspace.id },
      select: { userId: true },
    });
    if (!member) throw new Error("That person isn't a member of this workspace");
  }
  await db.tree.update({ where: { id: treeId }, data: { adminUserId } });
  revalidatePath(`/trees/${treeId}/settings`);
}

export async function updateDiscovery(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  const d = discoverySchema.parse(Object.fromEntries(formData));
  await db.tree.update({
    where: { id: treeId },
    data: {
      discoverable: d.discoverable,
      showcase: d.showcase,
      community: d.community || null,
      region: d.region || null,
    },
  });
  revalidateTag(SHOWCASE_TAG, "max");
  revalidatePath(`/trees/${treeId}/settings`);
}

const lineageSchema = z.object({
  clanInheritance: z.enum(["PATRILINEAL", "MATRILINEAL", "NONE"]).default("PATRILINEAL"),
  inheritSurname: z.coerce.boolean().default(false),
});

/** Default lineage rule for clan / family-name inheritance on new children. */
export async function updateLineage(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  const d = lineageSchema.parse(Object.fromEntries(formData));
  await db.tree.update({
    where: { id: treeId },
    data: { clanInheritance: d.clanInheritance, inheritSurname: d.inheritSurname },
  });
  revalidatePath(`/trees/${treeId}/settings`);
}

export async function updateAnniversaryReminders(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  await db.tree.update({
    where: { id: treeId },
    data: { anniversaryReminders: formData.get("on") === "1" },
  });
  revalidatePath(`/trees/${treeId}/settings`);
}

export async function deleteTree(treeId: string) {
  const ctx = await loadTreeContext(treeId);
  if (!canManageWorkspace(ctx.role)) throw new Error("Only the workspace owner can delete a tree");
  await db.tree.delete({ where: { id: treeId } });
  redirect("/app");
}
