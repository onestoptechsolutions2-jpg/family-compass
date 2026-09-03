"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ChildRelation, Gender, FamilyType, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requireTreeEdit, requireTreeManage } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { notifyRelativesOfEvent } from "@/lib/notify-kin";
import { notifyTreeManagers, notifyUser } from "@/lib/notify";
import { emitTreeEvent } from "@/lib/webhooks";
import { flashErr, flashOk } from "@/lib/flash";
import {
  createBarePerson,
  setVitalEvent,
  createPersonEvent,
  ensureMarriageEvent,
  addChildRef,
} from "@/lib/person-write";
import { applyLineageInheritance, cascadeClanDown } from "@/lib/lineage";
import { isPersonEventType } from "@/lib/event-types";
import { linkPersonToUser, releaseClaimOnDeath, issueClaimInvite } from "@/lib/claims";

const childRelationOf = (v: FormDataEntryValue | null): ChildRelation =>
  (Object.values(ChildRelation) as string[]).includes(String(v))
    ? (String(v) as ChildRelation)
    : ChildRelation.BIRTH;

const personBits = {
  first: z.string().trim().max(200).optional().default(""),
  surname: z.string().trim().max(200).optional().default(""),
  birthDate: z.string().trim().max(40).optional().default(""),
  birthPlace: z.string().trim().max(300).optional().default(""),
  living: z.coerce.boolean().optional().default(false),
  existingId: z.string().trim().max(40).optional().default(""),
  allowDup: z.string().trim().optional().default(""),
  namedAfterId: z.string().trim().max(40).optional().default(""),
};

type PersonBits = {
  first: string;
  surname: string;
  birthDate: string;
  birthPlace: string;
  living: boolean;
  existingId: string;
  allowDup: string;
  namedAfterId: string;
};

/** Validate a "named after" pick belongs to this tree; returns null otherwise. */
async function resolveNamedAfter(treeId: string, raw: string): Promise<string | null> {
  const id = raw.trim();
  if (!id) return null;
  const p = await db.person.findFirst({ where: { id, treeId }, select: { id: true } });
  return p?.id ?? null;
}

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
    namedAfterId: await resolveNamedAfter(treeId, d.namedAfterId),
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
  let childFamilyId: string;
  if (childOf) {
    const current =
      d.role === "father" ? childOf.family.partner1Id : childOf.family.partner2Id;
    if (current) throw new Error(`This person already has a ${d.role} recorded`);
    await db.family.update({ where: { id: childOf.familyId }, data: { [slot]: parent.id } });
    childFamilyId = childOf.familyId;
  } else {
    const fam = await db.family.create({
      data: {
        treeId,
        type: FamilyType.UNKNOWN,
        [slot]: parent.id,
        childRefs: { create: { personId, order: 0 } },
      },
      select: { id: true },
    });
    childFamilyId = fam.id;
  }

  // The child may now be able to take a blank clan / family name from this
  // new parent, per the tree's lineage rule.
  const inherited = await applyLineageInheritance(treeId, childFamilyId, personId);
  if (inherited) {
    // Adding an ancestor with a clan populates the whole line below them, not
    // just the immediate child.
    let carried = 0;
    if (inherited.clanId) {
      carried = await cascadeClanDown(treeId, personId, {
        fromClanId: null,
        toClanId: inherited.clanId,
        fromSubClan: null,
        toSubClan: null,
      });
    }
    await flashOk(
      `Added. This person now carries ${[
        inherited.clan && `${inherited.clan} clan`,
        inherited.surname && `the name ${inherited.surname}`,
      ]
        .filter(Boolean)
        .join(" and ")} from the ${d.role}${
        carried > 0 ? `, and it carried down to ${carried} descendant${carried === 1 ? "" : "s"}` : ""
      } — edit them if that's not right.`,
    );
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
  await addChildRef(familyId, child.id, childRelationOf(formData.get("childRelation")));
  // Applies regardless of whether the child was just created or already
  // existed in the tree — applyLineageInheritance only ever fills a blank
  // clan/surname, so it's always safe, and an existing person picked here
  // (the common case via QuickAdd's search) deserves it just as much as a
  // brand-new one.
  const inherited = await applyLineageInheritance(treeId, familyId, child.id);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "added",
    objectType: "person",
    objectId: child.id,
    summary: "added a child",
  });
  if (inherited) {
    await flashOk(
      `Added. Took ${[inherited.clan && `${inherited.clan} clan`, inherited.surname && `the name ${inherited.surname}`]
        .filter(Boolean)
        .join(" and ")} from the parent — edit the child if that's not right.`,
    );
  }
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
    select: { id: true, eventRefs: { where: { event: { type: { in: ["Death", "Burial"] } } }, select: { id: true } } },
  });
  if (!person) throw new Error("Person not found in this tree");
  const hadDeath = person.eventRefs.length > 0;

  await setVitalEvent(treeId, personId, "Death", d.deathDate, d.deathPlace);
  await db.person.update({ where: { id: personId }, data: { living: false } });
  await releaseClaimOnDeath(personId);

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
    await emitTreeEvent(treeId, "person.event_recorded", {
      personId,
      type: "Death",
      date: d.deathDate || null,
      place: d.deathPlace || null,
    });
  }

  if (!hadDeath) {
    await flashOk("Death recorded. There's a short checklist on the profile for the days ahead.");
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
    await releaseClaimOnDeath(personId);
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

  await emitTreeEvent(treeId, "person.event_recorded", {
    personId,
    type,
    date: d.date || null,
    place: d.place || null,
  });

  const MILESTONE = ["Graduation", "Retirement", "Baptism", "Christening", "Adoption", "Emigration", "Immigration", "Naturalization"];
  if (MILESTONE.includes(type)) {
    await flashOk(`${type} recorded. Add a photo, or a "Life now" update on the profile?`);
  }

  redirect(`/trees/${treeId}/people/${personId}`);
}

const PRIVACY_VALUES = ["INHERIT", "PUBLIC", "REDACTED", "PRIVATE"] as const;

/** Collect a person + every descendant (through the families they parent). */
async function descendantIds(treeId: string, rootId: string): Promise<string[]> {
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let depth = 0; depth < 40 && frontier.length; depth++) {
    const fams = await db.family.findMany({
      where: { treeId, OR: [{ partner1Id: { in: frontier } }, { partner2Id: { in: frontier } }] },
      select: { childRefs: { select: { personId: true } } },
    });
    const next: string[] = [];
    for (const f of fams) {
      for (const c of f.childRefs) {
        if (!seen.has(c.personId)) {
          seen.add(c.personId);
          next.push(c.personId);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

/** Set how much of a person is visible on public shared trees. With
 *  `cascade`, the same setting is applied to every descendant in one go —
 *  the quick way to "limit what can be seen" for a whole family line. */
export async function setPersonPrivacy(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = z
    .object({
      privacy: z.enum(PRIVACY_VALUES),
      datePrecision: z.enum(["FULL", "YEAR", "NONE"]).optional().default("FULL"),
      hidePhotos: z.coerce.boolean().optional().default(false),
      cascade: z.coerce.boolean().optional().default(false),
    })
    .parse(Object.fromEntries(formData));

  const person = await db.person.findFirst({ where: { id: personId, treeId }, select: { id: true } });
  if (!person) throw new Error("Person not found in this tree");

  const ids = d.cascade ? await descendantIds(treeId, personId) : [personId];
  await db.person.updateMany({
    where: { id: { in: ids }, treeId },
    data: {
      privacy: d.privacy,
      publicDatePrecision: d.datePrecision,
      hidePhotosPublic: d.hidePhotos,
    },
  });

  await emitTreeEvent(treeId, "person.privacy_changed", {
    personId,
    privacy: d.privacy,
    cascaded: d.cascade && ids.length > 1,
    affected: ids.length,
  });

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "updated",
    objectType: "person",
    objectId: personId,
    summary:
      d.cascade && ids.length > 1
        ? `set visibility to ${d.privacy.toLowerCase()} for ${ids.length} people`
        : `set visibility to ${d.privacy.toLowerCase()}`,
  });

  redirect(`/trees/${treeId}/people/${personId}`);
}

/** Editor generates a "claim your profile" link for a specific living,
 *  unclaimed person, to send to that relative (e.g. over WhatsApp). */
export async function createClaimInvite(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  await issueClaimInvite(treeId, personId, note, ctx.user.id);
  revalidatePath(`/trees/${treeId}/people/${personId}`);
}

/** Send a claim link to one of the profile's living, unclaimed relatives,
 *  then come back to the current profile with the fresh link shown. */
export async function inviteRelativeToClaim(
  treeId: string,
  hubPersonId: string,
  relativeId: string,
  _formData: FormData,
) {
  const ctx = await requireTreeEdit(treeId);
  try {
    await issueClaimInvite(treeId, relativeId, null, ctx.user.id);
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not create a claim link.");
    redirect(`/trees/${treeId}/people/${hubPersonId}`);
  }
  redirect(`/trees/${treeId}/people/${hubPersonId}?invited=${relativeId}`);
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
  await addChildRef(family.id, child.id, childRelationOf(formData.get("childRelation")));
  // See the comment in addChildToFamily — safe and correct unconditionally.
  const inherited = await applyLineageInheritance(treeId, family.id, child.id);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "added",
    objectType: "person",
    objectId: child.id,
    summary: "added a child",
  });
  if (inherited) {
    await flashOk(
      `Added. Took ${[inherited.clan && `${inherited.clan} clan`, inherited.surname && `the name ${inherited.surname}`]
        .filter(Boolean)
        .join(" and ")} from the parent — edit the child if that's not right.`,
    );
  }
  redirect(`/trees/${treeId}/people/${personId}`);
}

// ---- Event discussions -------------------------------------------------

/** Add a comment to an event's discussion thread. */
export async function addEventComment(
  treeId: string,
  personId: string,
  eventId: string,
  formData: FormData,
) {
  const ctx = await requireTreeEdit(treeId);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (body.length < 2) redirect(`/trees/${treeId}/people/${personId}#tab=timeline`);

  const ev = await db.event.findFirst({
    where: { id: eventId, treeId },
    select: {
      id: true,
      type: true,
      eventRefs: { select: { person: { select: { id: true, claimedByUserId: true } } } },
    },
  });
  if (!ev) throw new Error("Event not found in this tree");

  await db.eventComment.create({ data: { eventId, treeId, authorId: ctx.user.id, body } });

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "commented",
    objectType: "event",
    objectId: eventId,
    summary: `discussed a ${ev.type} event`,
  });

  // notify tree managers + any claimed person on this event (not the author)
  await notifyTreeManagers(
    treeId,
    {
      kind: "event.comment_added",
      title: `Discussion on a ${ev.type} event`,
      body: `${ctx.user.name ?? ctx.user.email}: "${body.slice(0, 140)}"`,
      linkPath: `/trees/${treeId}/people/${personId}#tab=timeline`,
    },
    { exceptUserId: ctx.user.id },
  );
  const claimers = [
    ...new Set(
      ev.eventRefs
        .map((r) => r.person?.claimedByUserId)
        .filter((id): id is string => !!id && id !== ctx.user.id),
    ),
  ];
  for (const uid of claimers) {
    await notifyUser(uid, {
      kind: "event.comment_added",
      title: `Discussion about your ${ev.type} record`,
      body: `${ctx.user.name ?? ctx.user.email}: "${body.slice(0, 140)}"`,
      treeId,
      linkPath: `/trees/${treeId}/people/${personId}#tab=timeline`,
    });
  }

  await emitTreeEvent(treeId, "event.comment_added", {
    eventId,
    personId,
    eventType: ev.type,
    excerpt: body.slice(0, 200),
  });

  redirect(`/trees/${treeId}/people/${personId}#tab=timeline`);
}

/** Mark a discussion thread resolved / reopen it. */
export async function resolveEventComment(
  treeId: string,
  personId: string,
  commentId: string,
  resolve: boolean,
) {
  const ctx = await requireTreeEdit(treeId);
  await db.eventComment.updateMany({
    where: { id: commentId, treeId },
    data: resolve
      ? { resolvedAt: new Date(), resolvedById: ctx.user.id }
      : { resolvedAt: null, resolvedById: null },
  });
  redirect(`/trees/${treeId}/people/${personId}#tab=timeline`);
}

// ---- Direct claim (manager shortcut) --------------------------------------

/** Manager binds a living, unclaimed profile straight to a workspace member
 *  (themselves or someone already on the tree) — no invite / request. */
export async function markProfileClaimed(
  treeId: string,
  personId: string,
  formData: FormData,
) {
  const ctx = await requireTreeManage(treeId);
  const who = String(formData.get("who") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "CONTRIBUTOR");
  const role = (Object.values(Role) as string[]).includes(roleRaw)
    ? (roleRaw as Role)
    : Role.CONTRIBUTOR;
  const userId = who === "me" ? ctx.user.id : who;
  if (!userId) {
    await flashErr("Choose who to link this profile to.");
    redirect(`/trees/${treeId}/people/${personId}`);
  }

  // only members of this tree's workspace can be linked here
  const member = await db.membership.findFirst({
    where: { userId, workspace: { trees: { some: { id: treeId } } } },
    select: { userId: true },
  });
  if (!member) {
    await flashErr("That person isn't a member of this tree.");
    redirect(`/trees/${treeId}/people/${personId}`);
  }

  await linkPersonToUser({ treeId, personId, userId, role, actorId: ctx.user.id });
  redirect(`/trees/${treeId}/people/${personId}`);
}

/** Manager unlinks a claimed profile (does not delete the account). */
export async function unlinkProfileClaim(treeId: string, personId: string) {
  await requireTreeManage(treeId);
  await db.person.updateMany({ where: { id: personId, treeId }, data: { claimedByUserId: null } });
  redirect(`/trees/${treeId}/people/${personId}`);
}
