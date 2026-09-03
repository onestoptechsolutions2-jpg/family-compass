"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ChildRelation, FamilyType } from "@prisma/client";

const childRelation = (v: FormDataEntryValue | null): ChildRelation =>
  (Object.values(ChildRelation) as string[]).includes(String(v))
    ? (String(v) as ChildRelation)
    : ChildRelation.BIRTH;

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { createBarePerson } from "@/lib/person-write";
import { applyLineageInheritance } from "@/lib/lineage";
import { emitTreeEvent } from "@/lib/webhooks";
import { flashOk, flashErr } from "@/lib/flash";
import { proposeMarriageLink } from "@/lib/identity-relationships";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * A person picker value is either an existing id, empty, or `new:<name>` from
 * the "＋ Add …" row. Resolve it to a real person id, creating one if asked.
 */
async function resolvePersonRef(
  treeId: string,
  actorId: string,
  raw: string | null,
): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("new:")) {
    const name = raw.slice(4).trim().slice(0, 120);
    if (name.length < 2) throw new Error("Enter a name for the new person");
    const [first, ...rest] = name.split(/\s+/);
    const person = await createBarePerson(treeId, {
      first: first || name,
      surname: rest.join(" ") || undefined,
      living: true,
    });
    await logActivity({
      treeId,
      actorId,
      verb: "created",
      objectType: "person",
      objectId: person.id,
      summary: `added ${name}`,
    });
    await emitTreeEvent(treeId, "person.created", { personId: person.id, name });
    return person.id;
  }
  const p = await db.person.findFirst({ where: { id: raw, treeId }, select: { id: true } });
  if (!p) throw new Error("Selected person is not in this tree");
  return raw;
}

const familySchema = z.object({
  partner1Id: z.preprocess(emptyToNull, z.string().nullable()),
  partner2Id: z.preprocess(emptyToNull, z.string().nullable()),
  type: z.enum(FamilyType).default(FamilyType.UNKNOWN),
});

export async function createFamily(treeId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = familySchema.parse(Object.fromEntries(formData));
  const p1 = await resolvePersonRef(treeId, ctx.user.id, d.partner1Id);
  const p2 = await resolvePersonRef(treeId, ctx.user.id, d.partner2Id);
  if (!p1 && !p2) {
    // A one-parent unit is fine (unmarried mother, unknown father); a
    // zero-parent unit is not — it would just be orphaned children.
    throw new Error("Add at least one parent (a single parent is fine).");
  }

  const family = await db.family.create({
    data: { treeId, partner1Id: p1, partner2Id: p2, type: d.type },
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
  const ctx = await requireTreeEdit(treeId);
  const d = familySchema.parse(Object.fromEntries(formData));
  const owned = await db.family.findFirst({ where: { id: familyId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Family not found");
  const p1 = await resolvePersonRef(treeId, ctx.user.id, d.partner1Id);
  const p2 = await resolvePersonRef(treeId, ctx.user.id, d.partner2Id);

  await db.family.update({
    where: { id: familyId },
    data: { partner1Id: p1, partner2Id: p2, type: d.type },
  });
  revalidatePath(`/trees/${treeId}/families/${familyId}`);
  redirect(`/trees/${treeId}/families/${familyId}`);
}

export async function addChild(treeId: string, familyId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const owned = await db.family.findFirst({ where: { id: familyId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Family not found");
  const personId = await resolvePersonRef(treeId, ctx.user.id, String(formData.get("personId") ?? "").trim() || null);
  if (!personId) throw new Error("Choose or add a child");
  const rel = childRelation(formData.get("childRelation"));

  const count = await db.childRef.count({ where: { familyId } });
  await db.childRef.upsert({
    where: { familyId_personId: { familyId, personId } },
    update: { partner1Relation: rel, partner2Relation: rel },
    create: { familyId, personId, order: count, partner1Relation: rel, partner2Relation: rel },
  });

  const namedAfter = String(formData.get("namedAfterId") ?? "").trim();
  if (namedAfter) {
    const ok = await db.person.findFirst({ where: { id: namedAfter, treeId }, select: { id: true } });
    if (ok) await db.person.update({ where: { id: personId }, data: { namedAfterId: ok.id } });
  }
  await applyLineageInheritance(treeId, familyId, personId);

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

/** Propose that this marriage bridges to the partner's other tree, if
 *  they're already recorded elsewhere as a linked Identity. See
 *  docs/relationship-rules.md and src/lib/identity-relationships.ts. */
export async function proposeMarriageLinkAction(treeId: string, familyId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const personId = String(formData.get("personId") ?? "");
  try {
    const { alreadyExisted } = await proposeMarriageLink({ treeId, personId, familyId, actorId: ctx.user.id });
    await flashOk(
      alreadyExisted
        ? "A connection request already exists for this marriage."
        : "Sent — the other family's tree will see a request to confirm this marriage.",
    );
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not send that connection request.");
  }
  revalidatePath(`/trees/${treeId}/families/${familyId}`);
}
