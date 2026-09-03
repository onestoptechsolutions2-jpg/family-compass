"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SHOWCASE_TAG } from "@/lib/queries/showcase";

import { db } from "@/lib/db";
import { requireTreeManage, loadTreeContext } from "@/lib/rbac";
import { canManageWorkspace } from "@/lib/rbac";
import { applyLineageInheritance } from "@/lib/lineage";
import { flashOk } from "@/lib/flash";

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

/**
 * Bring existing children in line with the lineage rule: for every child with
 * no clan (and, if enabled, no family name) recorded, copy it from the lineage
 * parent. Only fills blanks — never changes a clan already set.
 *
 * Runs as a fixed-point sweep, not a single pass: a grandchild's blank clan
 * can only be filled once their own parent's clan has been filled, but a
 * single pass processes childRefs in no particular (let alone ancestor-first)
 * order — so a one-pass version would randomly miss later generations
 * depending on row order. Repeating until a full pass changes nothing makes
 * the backfill actually follow the whole lineage top to bottom, however many
 * generations deep, in one click.
 */
export async function backfillLineage(treeId: string) {
  await requireTreeManage(treeId);

  let filled = 0;
  for (let pass = 0; pass < 20; pass++) {
    const children = await db.childRef.findMany({
      where: { family: { treeId }, person: { clanId: null } },
      select: { familyId: true, personId: true },
    });
    if (children.length === 0) break;

    let passFilled = 0;
    for (const c of children) {
      const applied = await applyLineageInheritance(treeId, c.familyId, c.personId);
      if (applied?.clan || applied?.surname) passFilled++;
    }
    filled += passFilled;
    if (passFilled === 0) break; // converged — nothing left to propagate
  }

  await flashOk(
    filled > 0
      ? `Filled clan/name for ${filled} ${filled === 1 ? "child" : "children"} across the lineage.`
      : "Nothing to fill — every child already has a clan, or no parent has one recorded.",
  );
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
