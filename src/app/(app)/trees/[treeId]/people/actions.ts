"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Gender, Privacy, DateModifier, DateQuality } from "@prisma/client";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { parseISODateInput, dateSortKey } from "@/lib/date";
import { logActivity } from "@/lib/activity";
import { notifyRelativesOfEvent } from "@/lib/notify-kin";
import { emitTreeEvent } from "@/lib/webhooks";

const label = (first?: string, surname?: string) =>
  `${first ?? ""} ${surname ?? ""}`.trim() || "a person";

const personSchema = z.object({
  first: z.string().trim().max(200).optional().default(""),
  surname: z.string().trim().max(200).optional().default(""),
  gender: z.enum(Gender).default(Gender.UNKNOWN),
  living: z.coerce.boolean().default(false),
  privacy: z.enum(Privacy).default(Privacy.INHERIT),
  clanId: z.string().trim().optional().default(""),
  subClan: z.string().trim().max(120).optional().default(""),
  birthDate: z.string().trim().max(40).optional().default(""),
  birthPlace: z.string().trim().max(300).optional().default(""),
  deathDate: z.string().trim().max(40).optional().default(""),
  deathPlace: z.string().trim().max(300).optional().default(""),
});

async function resolveClan(treeId: string, clanId: string): Promise<string | null> {
  if (!clanId) return null;
  const c = await db.clan.findFirst({ where: { id: clanId, treeId }, select: { id: true } });
  return c?.id ?? null;
}

function parse(formData: FormData) {
  const parsed = personSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  return parsed.data;
}

async function upsertPlace(treeId: string, title: string): Promise<string | null> {
  const t = title.trim();
  if (!t) return null;
  const existing = await db.place.findFirst({ where: { treeId, title: t }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.place.create({ data: { treeId, title: t }, select: { id: true } });
  return created.id;
}

function dateData(raw: string) {
  const iso = parseISODateInput(raw);
  if (iso.dateYear) {
    return {
      dateModifier: DateModifier.EXACT,
      dateQuality: DateQuality.NONE,
      dateYear: iso.dateYear,
      dateMonth: iso.dateMonth,
      dateDay: iso.dateDay,
      dateText: null as string | null,
      dateSortKey: dateSortKey(iso),
    };
  }
  if (raw.trim()) {
    return {
      dateModifier: DateModifier.NONE,
      dateQuality: DateQuality.NONE,
      dateYear: null,
      dateMonth: null,
      dateDay: null,
      dateText: raw.trim(),
      dateSortKey: `~${raw.trim()}`,
    };
  }
  return null;
}

async function syncVitalEvent(
  treeId: string,
  personId: string,
  type: "Birth" | "Death",
  rawDate: string,
  rawPlace: string,
): Promise<"created" | "updated" | "deleted" | "noop"> {
  const existing = await db.eventRef.findFirst({
    where: { personId, role: "PRIMARY", event: { type } },
    select: { id: true, eventId: true },
  });
  const dd = dateData(rawDate);
  const placeId = await upsertPlace(treeId, rawPlace);

  if (!dd && !placeId) {
    if (existing) {
      await db.event.delete({ where: { id: existing.eventId } });
      return "deleted";
    }
    return "noop";
  }

  const eventData = {
    type,
    placeId,
    dateModifier: dd?.dateModifier ?? DateModifier.NONE,
    dateQuality: dd?.dateQuality ?? DateQuality.NONE,
    dateYear: dd?.dateYear ?? null,
    dateMonth: dd?.dateMonth ?? null,
    dateDay: dd?.dateDay ?? null,
    dateText: dd?.dateText ?? null,
    dateSortKey: dd?.dateSortKey ?? null,
  };

  if (existing) {
    await db.event.update({ where: { id: existing.eventId }, data: eventData });
    return "updated";
  }
  await db.event.create({
    data: {
      treeId,
      ...eventData,
      eventRefs: { create: { personId, role: "PRIMARY" } },
    },
  });
  return "created";
}

export async function createPerson(treeId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = parse(formData);

  const person = await db.person.create({
    data: {
      treeId,
      gender: d.gender,
      living: d.living,
      privacy: d.privacy,
      clanId: await resolveClan(treeId, d.clanId),
      subClan: d.subClan || null,
      names: {
        create: {
          type: "BIRTH",
          preferred: true,
          order: 0,
          first: d.first || null,
          surname: d.surname || null,
        },
      },
    },
    select: { id: true },
  });

  await syncVitalEvent(treeId, person.id, "Birth", d.birthDate, d.birthPlace);
  const deathSync = await syncVitalEvent(treeId, person.id, "Death", d.deathDate, d.deathPlace);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "created",
    objectType: "person",
    objectId: person.id,
    summary: `added ${label(d.first, d.surname)}`,
  });

  if (deathSync === "created") {
    await notifyRelativesOfEvent({
      treeId,
      personId: person.id,
      eventType: "Death",
      dateText: d.deathDate || null,
      placeText: d.deathPlace || null,
      actorUserId: ctx.user.id,
    });
    await emitTreeEvent(treeId, "person.event_recorded", {
      personId: person.id,
      type: "Death",
      date: d.deathDate || null,
      place: d.deathPlace || null,
    });
  }

  revalidatePath(`/trees/${treeId}/people`);
  redirect(`/trees/${treeId}/people/${person.id}`);
}

export async function updatePerson(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const d = parse(formData);

  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: { id: true, names: { orderBy: { order: "asc" } } },
  });
  if (!person) throw new Error("Person not found");

  const primary =
    person.names.find((n) => n.preferred) ?? person.names.find((n) => n.type === "BIRTH") ?? person.names[0];

  await db.person.update({
    where: { id: personId },
    data: {
      gender: d.gender,
      living: d.living,
      privacy: d.privacy,
      clanId: await resolveClan(treeId, d.clanId),
      subClan: d.subClan || null,
      names: primary
        ? { update: { where: { id: primary.id }, data: { first: d.first || null, surname: d.surname || null } } }
        : {
            create: {
              type: "BIRTH",
              preferred: true,
              order: 0,
              first: d.first || null,
              surname: d.surname || null,
            },
          },
    },
  });

  await syncVitalEvent(treeId, personId, "Birth", d.birthDate, d.birthPlace);
  const deathSync = await syncVitalEvent(treeId, personId, "Death", d.deathDate, d.deathPlace);

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "updated",
    objectType: "person",
    objectId: personId,
    summary: `edited ${label(d.first, d.surname)}`,
  });

  if (deathSync === "created") {
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

  revalidatePath(`/trees/${treeId}/people/${personId}`);
  redirect(`/trees/${treeId}/people/${personId}`);
}

export async function deletePerson(treeId: string, personId: string) {
  await requireTreeEdit(treeId);
  const owned = await db.person.findFirst({ where: { id: personId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Person not found");
  await db.person.delete({ where: { id: personId } });
  revalidatePath(`/trees/${treeId}/people`);
  redirect(`/trees/${treeId}/people`);
}
