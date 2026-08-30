"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Gender, FamilyType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { notifyRelativesOfEvent } from "@/lib/notify-kin";
import { randomToken } from "@/lib/slug";
import {
  createBarePerson,
  setVitalEvent,
  createPersonEvent,
  ensureMarriageEvent,
  addChildRef,
} from "@/lib/person-write";
import { isPersonEventType } from "@/lib/event-types";

const personBits = {
  first: z.string().trim().max(200).optional().default(""),
  surname: z.string().trim().max(200).optional().default(""),
  birthDate: z.string().trim().max(40).optional().default(""),
  birthPlace: z.string().trim().max(300).optional().default(""),
  living: z.coerce.boolean().optional().default(false),
  existingId: z.string().trim().max(40).optional().default(""),
  allowDup: z.string().trim().optional().default(""),
};

type PersonBits = {
  first: string;
  surname: string;
  birthDate: string;
  birthPlace: string;
  living: boolean;
  existingId: string;
  allowDup: string;
};

async function assertFamilyInTree(treeId: string, familyId: string) {
  const f = await db.family.findFirst({ where: { id: familyId, treeId }, select: { id: true } });
  if (!f) throw new Error("Family not found in this tree");
}

/** Guard against accidentally creating a second person with the same name. */
async function assertNoDuplicate(treeId: string, first: string, surname: string, allow: boolean) {
  if (allow || !first.trim() || !surname.trim()) return;
  const match = await db.person.findFirst({
    where: {
      treeId,
      names: {
        some: {
          first: { equals: first.trim(), mode: "insensitive" },
          surname: { equals: surname.trim(), mode: "insensitive" },
        },
      },
    },
    select: { id: true },
  });
  if (match) {
    throw new Error(
      `"${first} ${surname}" is already in this tree — link that person from the list, or tick "Add even if…".`,
    );
  }
}

/** Use the picked existing person, or create a new one (with a Birth event). */
async function resolveOrCreatePerson(
  treeId: string,
  d: PersonBits,
  opts: { gender?: Gender } = {},
): Promise<{ id: string; created: boolean }> {
  if (d.existingId) {
    const p = await db.person.findFirst({
      where: { id: d.existingId, treeId },
      select: { id: true },
    });
    if (!p) throw new Error("That person is not in this tree");
    return { id: p.id, created: false };
  }
  await assertNoDuplicate(treeId, d.first, d.surname, d.allowDup === "1");
  const p = await createBarePerson(treeId, {
    first: d.first,
    surname: d.surname,
    gender: opts.gender,
    living: d.living,
  });
  await setVitalEvent(treeId, p.id, "Birth", d.birthDate, d.birthPlace);
  return { id: p.id, created: true };
}

export async function addParent(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = z
    .object({ role: z.enum(["father", "mother"]), ...personBits })
    .parse(Object.fromEntries(formData));

  const childOf = await db.childRef.findFirst({
    where: { personId, family: { treeId } },
    select: { familyId: true, family: { select: { partner1Id: true, partner2Id: true } } },
  });

  const parent = await resolveOrCreatePerson(treeId, d, {
    gender: d.role === "father" ? Gender.MALE : Gender.FEMALE,
  });
  if (parent.id === personId) throw new Error("A person cannot be their own parent");

  const slot = d.role === "father" ? "partner1Id" : "partner2Id";
  if (childOf) {
    const current =
      d.role === "father" ? childOf.family.partner1Id : childOf.family.partner2Id;
    if (current) throw new Error(`This person already has a ${d.role} recorded`);
    await db.family.update({ where: { id: childOf.familyId }, data: { [slot]: parent.id } });
  } else {
    await db.family.create({
      data: {
        treeId,
        type: FamilyType.UNKNOWN,
        [slot]: parent.id,
        childRefs: { create: { personId, order: 0 } },
      },
    });
  }

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "added",
    objectType: "person",
    objectId: parent.id,
    summary: `added a ${d.role}`,
  });
  redirect(`/trees/${treeId}/people/${personId}`);
}

export async function addPartner(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = z
    .object({
      gender: z.enum(Gender).default(Gender.UNKNOWN),
      type: z.enum(FamilyType).default(FamilyType.MARRIED),
      marriageDate: z.string().trim().max(40).optional().default(""),
      marriagePlace: z.string().trim().max(300).optional().default(""),
      ...personBits,
    })
    .parse(Object.fromEntries(formData));

  const partner = await resolveOrCreatePerson(treeId, d, { gender: d.gender });
  if (partner.id === personId) throw new Error("A person cannot be their own partner");

  const existingUnion = await db.family.findFirst({
    where: {
      treeId,
      OR: [
        { partner1Id: personId, partner2Id: partner.id },
        { partner1Id: partner.id, partner2Id: personId },
      ],
    },
    select: { id: true },
  });
  const family = existingUnion
    ? existingUnion
    : await db.family.create({
        data: { treeId, type: d.type, partner1Id: personId, partner2Id: partner.id },
        select: { id: true },
      });
  await ensureMarriageEvent(treeId, family.id, d.marriageDate, d.marriagePlace);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "added",
    objectType: "family",
    objectId: family.id,
    summary: "added a partner",
  });
  redirect(`/trees/${treeId}/people/${personId}`);
}

export async function addChildToFamily(treeId: string, familyId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  await assertFamilyInTree(treeId, familyId);
  const back = String(formData.get("back") ?? "").trim();
  const d = z.object(personBits).parse(Object.fromEntries(formData));

  const child = await resolveOrCreatePerson(treeId, d);
  const fam = await db.family.findUnique({
    where: { id: familyId },
    select: { partner1Id: true, partner2Id: true },
  });
  if (fam && (fam.partner1Id === child.id || fam.partner2Id === child.id)) {
    throw new Error("That person is a partner in this family and cannot also be its child");
  }
  await addChildRef(familyId, child.id);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "added",
    objectType: "person",
    objectId: child.id,
    summary: "added a child",
  });
  redirect(back.startsWith("/") ? back : `/trees/${treeId}/people/${child.id}`);
}

/** Record a death: marks the person deceased and sets the Death event.
 *  This is the canonical way to identify a deceased person — it flips the
 *  `living` flag and creates a dated Death event that drives the memorial,
 *  redaction, and "deceased" markers across the app. */
export async function recordDeath(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = z
    .object({
      deathDate: z.string().trim().max(40).optional().default(""),
      deathPlace: z.string().trim().max(300).optional().default(""),
    })
    .parse(Object.fromEntries(formData));

  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: { id: true, eventRefs: { where: { event: { type: "Death" } }, select: { id: true } } },
  });
  if (!person) throw new Error("Person not found in this tree");
  const hadDeath = person.eventRefs.length > 0;

  await setVitalEvent(treeId, personId, "Death", d.deathDate, d.deathPlace);
  await db.person.update({ where: { id: personId }, data: { living: false } });

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "updated",
    objectType: "person",
    objectId: personId,
    summary: "recorded a death",
  });

  if (!hadDeath) {
    await notifyRelativesOfEvent({
      treeId,
      personId,
      eventType: "Death",
      dateText: d.deathDate || null,
      placeText: d.deathPlace || null,
      actorUserId: ctx.user.id,
    });
  }

  redirect(`/trees/${treeId}/people/${personId}`);
}

/** Add any timeline event (Baptism, Graduation, Residence, …) to a person.
 *  A Death/Burial here also flips `living` and notifies relatives, so it
 *  stays consistent with recordDeath. */
export async function addEvent(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = z
    .object({
      type: z.string().trim().min(1).max(40),
      date: z.string().trim().max(40).optional().default(""),
      place: z.string().trim().max(300).optional().default(""),
      description: z.string().trim().max(500).optional().default(""),
    })
    .parse(Object.fromEntries(formData));

  const type = isPersonEventType(d.type) ? d.type : "Other";
  const person = await db.person.findFirst({ where: { id: personId, treeId }, select: { id: true } });
  if (!person) throw new Error("Person not found in this tree");

  await createPersonEvent(treeId, personId, type, d.date, d.place, d.description);

  const isDeath = type === "Death" || type === "Burial";
  if (isDeath) {
    await db.person.update({ where: { id: personId }, data: { living: false } });
  }

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "updated",
    objectType: "person",
    objectId: personId,
    summary: `added a ${type} event`,
  });

  // only ping relatives for the milestones that matter to a family
  const NOTIFY_TYPES = ["Birth", "Death", "Burial", "Baptism", "Christening", "Adoption"];
  if (NOTIFY_TYPES.includes(type)) {
    await notifyRelativesOfEvent({
      treeId,
      personId,
      eventType: type,
      dateText: d.date || null,
      placeText: d.place || null,
      actorUserId: ctx.user.id,
    });
  }

  redirect(`/trees/${treeId}/people/${personId}`);
}

/** Editor generates a "claim your profile" link for a specific living,
 *  unclaimed person, to send to that relative (e.g. over WhatsApp). */
export async function createClaimInvite(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      claimedByUserId: true,
      eventRefs: { where: { event: { type: { in: ["Death", "Burial"] } } }, select: { id: true } },
    },
  });
  if (!person) throw new Error("Person not found in this tree");
  if (person.claimedByUserId) throw new Error("This profile is already claimed");
  if (person.eventRefs.length > 0) throw new Error("This person is recorded as deceased");

  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  // keep a single live invite per person
  await db.claimInvite.updateMany({
    where: { personId, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date() },
  });
  await db.claimInvite.create({
    data: {
      treeId,
      personId,
      token: randomToken(24),
      note,
      createdById: ctx.user.id,
      expiresAt: new Date(Date.now() + 30 * 864e5),
    },
  });
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "invited",
    objectType: "person",
    objectId: personId,
    summary: "sent a profile claim link",
  });
  revalidatePath(`/trees/${treeId}/people/${personId}`);
}

export async function revokeClaimInvite(treeId: string, personId: string, inviteId: string) {
  await requireTreeEdit(treeId);
  await db.claimInvite.updateMany({
    where: { id: inviteId, treeId },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/trees/${treeId}/people/${personId}`);
}

/** Add a first child to a person who has no family yet. */
export async function addFirstChild(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = z.object(personBits).parse(Object.fromEntries(formData));

  const child = await resolveOrCreatePerson(treeId, d);
  if (child.id === personId) throw new Error("A person cannot be their own child");
  const family = await db.family.create({
    data: { treeId, type: FamilyType.UNKNOWN, partner1Id: personId },
    select: { id: true },
  });
  await addChildRef(family.id, child.id);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "added",
    objectType: "person",
    objectId: child.id,
    summary: "added a child",
  });
  redirect(`/trees/${treeId}/people/${personId}`);
}
