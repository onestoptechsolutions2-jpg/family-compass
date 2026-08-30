"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FamilyType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const familySchema = z.object({
  partner1Id: z.preprocess(emptyToNull, z.string().nullable()),
  partner2Id: z.preprocess(emptyToNull, z.string().nullable()),
  type: z.enum(FamilyType).default(FamilyType.UNKNOWN),
});

async function assertPersonInTree(treeId: string, id: string | null) {
  if (!id) return;
  const p = await db.person.findFirst({ where: { id, treeId }, select: { id: true } });
  if (!p) throw new Error("Selected person is not in this tree");
}

export async function createFamily(treeId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = familySchema.parse(Object.fromEntries(formData));
  await assertPersonInTree(treeId, d.partner1Id);
  await assertPersonInTree(treeId, d.partner2Id);

  const family = await db.family.create({
    data: { treeId, partner1Id: d.partner1Id, partner2Id: d.partner2Id, type: d.type },
    select: { id: true },
  });
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "created",
    objectType: "family",
    objectId: family.id,
    summary: "created a family",
  });
  revalidatePath(`/trees/${treeId}/families`);
  redirect(`/trees/${treeId}/families/${family.id}`);
}

export async function updateFamily(treeId: string, familyId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const d = familySchema.parse(Object.fromEntries(formData));
  await assertPersonInTree(treeId, d.partner1Id);
  await assertPersonInTree(treeId, d.partner2Id);
  const owned = await db.family.findFirst({ where: { id: familyId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Family not found");

  await db.family.update({
    where: { id: familyId },
    data: { partner1Id: d.partner1Id, partner2Id: d.partner2Id, type: d.type },
  });
  revalidatePath(`/trees/${treeId}/families/${familyId}`);
  redirect(`/trees/${treeId}/families/${familyId}`);
}

export async function addChild(treeId: string, familyId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const personId = String(formData.get("personId") ?? "").trim();
  const owned = await db.family.findFirst({ where: { id: familyId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Family not found");
  await assertPersonInTree(treeId, personId);

  const count = await db.childRef.count({ where: { familyId } });
  await db.childRef.upsert({
    where: { familyId_personId: { familyId, personId } },
    update: {},
    create: { familyId, personId, order: count },
  });
  revalidatePath(`/trees/${treeId}/families/${familyId}`);
}

export async function removeChild(treeId: string, familyId: string, childRefId: string) {
  await requireTreeEdit(treeId);
  const ref = await db.childRef.findFirst({
    where: { id: childRefId, family: { id: familyId, treeId } },
    select: { id: true },
  });
  if (!ref) throw new Error("Child link not found");
  await db.childRef.delete({ where: { id: childRefId } });
  revalidatePath(`/trees/${treeId}/families/${familyId}`);
}

export async function deleteFamily(treeId: string, familyId: string) {
  await requireTreeEdit(treeId);
  const owned = await db.family.findFirst({ where: { id: familyId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Family not found");
  await db.family.delete({ where: { id: familyId } });
  revalidatePath(`/trees/${treeId}/families`);
  redirect(`/trees/${treeId}/families`);
}
