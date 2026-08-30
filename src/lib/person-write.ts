import { DateModifier, DateQuality, Gender } from "@prisma/client";

import { db } from "@/lib/db";
import { parseISODateInput, dateSortKey } from "@/lib/date";

export async function createBarePerson(
  treeId: string,
  input: { first?: string; surname?: string; gender?: Gender; living?: boolean },
): Promise<{ id: string }> {
  return db.person.create({
    data: {
      treeId,
      gender: input.gender ?? Gender.UNKNOWN,
      living: input.living ?? false,
      names: {
        create: {
          type: "BIRTH",
          preferred: true,
          order: 0,
          first: input.first?.trim() || null,
          surname: input.surname?.trim() || null,
        },
      },
    },
    select: { id: true },
  });
}

export async function upsertPlaceByTitle(treeId: string, title: string): Promise<string | null> {
  const t = title.trim();
  if (!t) return null;
  const existing = await db.place.findFirst({ where: { treeId, title: t }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.place.create({ data: { treeId, title: t }, select: { id: true } });
  return created.id;
}

function dateFields(raw: string) {
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
      any: true,
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
      any: true,
    };
  }
  return null;
}

export type VitalEventResult = "created" | "updated" | "deleted" | "noop";

/** Create/update a person's primary Birth/Death event (delete if both blank). */
export async function setVitalEvent(
  treeId: string,
  personId: string,
  type: "Birth" | "Death",
  rawDate: string,
  rawPlace: string,
): Promise<VitalEventResult> {
  const existing = await db.eventRef.findFirst({
    where: { personId, role: "PRIMARY", event: { type } },
    select: { id: true, eventId: true },
  });
  const d = dateFields(rawDate);
  const placeId = await upsertPlaceByTitle(treeId, rawPlace);

  if (!d && !placeId) {
    if (existing) {
      await db.event.delete({ where: { id: existing.eventId } });
      return "deleted";
    }
    return "noop";
  }
  const data = {
    type,
    placeId,
    dateModifier: d?.dateModifier ?? DateModifier.NONE,
    dateQuality: d?.dateQuality ?? DateQuality.NONE,
    dateYear: d?.dateYear ?? null,
    dateMonth: d?.dateMonth ?? null,
    dateDay: d?.dateDay ?? null,
    dateText: d?.dateText ?? null,
    dateSortKey: d?.dateSortKey ?? null,
  };
  if (existing) {
    await db.event.update({ where: { id: existing.eventId }, data });
    return "updated";
  }
  await db.event.create({
    data: { treeId, ...data, eventRefs: { create: { personId, role: "PRIMARY" } } },
  });
  return "created";
}

export async function ensureMarriageEvent(
  treeId: string,
  familyId: string,
  rawDate: string,
  rawPlace: string,
): Promise<void> {
  const d = dateFields(rawDate);
  const placeId = await upsertPlaceByTitle(treeId, rawPlace);
  if (!d && !placeId) return;
  const existing = await db.eventRef.findFirst({
    where: { familyId, event: { type: "Marriage" } },
    select: { eventId: true },
  });
  const data = {
    type: "Marriage",
    placeId,
    dateModifier: d?.dateModifier ?? DateModifier.NONE,
    dateQuality: d?.dateQuality ?? DateQuality.NONE,
    dateYear: d?.dateYear ?? null,
    dateMonth: d?.dateMonth ?? null,
    dateDay: d?.dateDay ?? null,
    dateText: d?.dateText ?? null,
    dateSortKey: d?.dateSortKey ?? null,
  };
  if (existing) await db.event.update({ where: { id: existing.eventId }, data });
  else
    await db.event.create({
      data: { treeId, ...data, eventRefs: { create: { familyId, role: "FAMILY" } } },
    });
}

/** Add a standalone timeline event to a person (any type). Returns the new id. */
export async function createPersonEvent(
  treeId: string,
  personId: string,
  type: string,
  rawDate: string,
  rawPlace: string,
  description: string,
): Promise<string> {
  const d = dateFields(rawDate);
  const placeId = await upsertPlaceByTitle(treeId, rawPlace);
  const ev = await db.event.create({
    data: {
      treeId,
      type,
      placeId,
      description: description.trim() || null,
      dateModifier: d?.dateModifier ?? DateModifier.NONE,
      dateQuality: d?.dateQuality ?? DateQuality.NONE,
      dateYear: d?.dateYear ?? null,
      dateMonth: d?.dateMonth ?? null,
      dateDay: d?.dateDay ?? null,
      dateText: d?.dateText ?? null,
      dateSortKey: d?.dateSortKey ?? null,
      eventRefs: { create: { personId, role: "PRIMARY" } },
    },
    select: { id: true },
  });
  return ev.id;
}

export async function addChildRef(familyId: string, personId: string): Promise<void> {
  const count = await db.childRef.count({ where: { familyId } });
  await db.childRef.upsert({
    where: { familyId_personId: { familyId, personId } },
    update: {},
    create: { familyId, personId, order: count },
  });
}
