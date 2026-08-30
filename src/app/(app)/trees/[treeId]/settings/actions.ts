"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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
  community: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
});

export async function updateDiscovery(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  const d = discoverySchema.parse(Object.fromEntries(formData));
  await db.tree.update({
    where: { id: treeId },
    data: {
      discoverable: d.discoverable,
      community: d.community || null,
      region: d.region || null,
    },
  });
  revalidatePath(`/trees/${treeId}/settings`);
}

export async function deleteTree(treeId: string) {
  const ctx = await loadTreeContext(treeId);
  if (!canManageWorkspace(ctx.role)) throw new Error("Only the workspace owner can delete a tree");
  await db.tree.delete({ where: { id: treeId } });
  redirect("/app");
}
