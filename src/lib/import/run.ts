import { EventRole, ImportKind, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { parseGrampsXml } from "@/lib/import/gramps";
import { parseGedcom } from "@/lib/import/gedcom";
import type { ImpDate, ParsedTree } from "@/lib/import/intermediate";

export type ImportReport = {
  people: number;
  families: number;
  events: number;
  places: number;
  notes: number;
  skipped: number;
  warnings: string[];
};

function sortKey(d: ImpDate | null): string | null {
  if (!d?.year) return d?.text ? `~${d.text}` : null;
  const y = String(d.year).padStart(4, "0");
  const m = d.month ? String(d.month).padStart(2, "0") : "00";
  const day = d.day ? String(d.day).padStart(2, "0") : "00";
  return `${y}-${m}-${day}`;
}

function eventRole(raw: string, familyContext: boolean): EventRole {
  switch (raw.toLowerCase()) {
    case "primary":
      return EventRole.PRIMARY;
    case "family":
      return EventRole.FAMILY;
    case "witness":
      return EventRole.WITNESS;
    case "clergy":
      return EventRole.CLERGY;
    case "informant":
      return EventRole.INFORMANT;
    case "bride":
      return EventRole.BRIDE;
    case "groom":
      return EventRole.GROOM;
    default:
      return familyContext ? EventRole.FAMILY : EventRole.PRIMARY;
  }
}

async function idMap(
  model: "place" | "event" | "person" | "family",
  treeId: string,
): Promise<Map<string, string>> {
  const where = { treeId, grampsId: { not: null } } as const;
  const select = { id: true, grampsId: true } as const;
  const rows =
    model === "place"
      ? await db.place.findMany({ where, select })
      : model === "event"
        ? await db.event.findMany({ where, select })
        : model === "person"
          ? await db.person.findMany({ where, select })
          : await db.family.findMany({ where, select });
  return new Map(
    rows.filter((r) => r.grampsId).map((r) => [r.grampsId as string, r.id] as const),
  );
}

export async function runImport(importJobId: string, kind: ImportKind): Promise<ImportReport> {
  const job = await db.importJob.findUniqueOrThrow({ where: { id: importJobId } });
  const bytes = Buffer.from(job.fileBytes);
  const treeId = job.treeId;

  const parsed: ParsedTree =
    kind === ImportKind.GEDCOM ? parseGedcom(bytes) : parseGrampsXml(bytes);

  const warnings = [...parsed.warnings];
  let skipped = 0;

  // Which xrefs already exist (re-import safety) ------------------------------
  const existing = {
    place: await idMap("place", treeId),
    event: await idMap("event", treeId),
    person: await idMap("person", treeId),
    family: await idMap("family", treeId),
  };
  const isNew = (m: Map<string, string>, xref: string) => !m.has(xref);

  // ---- Places -------------------------------------------------------------
  const newPlaces = parsed.places.filter((p) => isNew(existing.place, p.xref));
  if (newPlaces.length) {
    await db.place.createMany({
      data: newPlaces.map((p) => ({
        treeId,
        grampsId: p.xref,
        title: p.title,
        type: p.type,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      skipDuplicates: true,
    });
  }
  const placeMap = await idMap("place", treeId);

  // ---- Events ----------------------------------------------------------------
  const newEvents = parsed.events.filter((e) => isNew(existing.event, e.xref));
  if (newEvents.length) {
    await db.event.createMany({
      data: newEvents.map((e) => ({
        treeId,
        grampsId: e.xref,
        type: e.type,
        description: e.description,
        placeId: e.placeXref ? (placeMap.get(e.placeXref) ?? null) : null,
        dateModifier: e.date?.modifier ?? "NONE",
        dateQuality: e.date?.quality ?? "NONE",
        dateYear: e.date?.year ?? null,
        dateMonth: e.date?.month ?? null,
        dateDay: e.date?.day ?? null,
        dateYear2: e.date?.year2 ?? null,
        dateMonth2: e.date?.month2 ?? null,
        dateDay2: e.date?.day2 ?? null,
        dateText: e.date?.text ?? null,
        dateSortKey: sortKey(e.date),
      })),
      skipDuplicates: true,
    });
  }
  const eventMap = await idMap("event", treeId);

  // ---- People -------------------------------------------------------------
  const newPeople = parsed.people.filter((p) => isNew(existing.person, p.xref));
  if (newPeople.length) {
    await db.person.createMany({
      data: newPeople.map((p) => ({
        treeId,
        grampsId: p.xref,
        gender: p.gender,
        living: p.living,
      })),
      skipDuplicates: true,
    });
  }
  const personMap = await idMap("person", treeId);

  // Names + person event refs (only for newly-created people)
  const nameRows: Prisma.NameCreateManyInput[] = [];
  const personEventRefRows: Prisma.EventRefCreateManyInput[] = [];
  for (const p of newPeople) {
    const personId = personMap.get(p.xref);
    if (!personId) continue;
    p.names.forEach((n, i) => {
      nameRows.push({
        personId,
        type: n.type,
        preferred: n.preferred || i === 0,
        order: i,
        title: n.title ?? null,
        first: n.first ?? null,
        nick: n.nick ?? null,
        callName: n.callName ?? null,
        surnamePrefix: n.surnamePrefix ?? null,
        surname: n.surname ?? null,
        suffix: n.suffix ?? null,
      });
    });
    p.eventRefs.forEach((r, i) => {
      const eventId = eventMap.get(r.eventXref);
      if (!eventId) return;
      personEventRefRows.push({ eventId, personId, role: eventRole(r.role, false), order: i });
    });
  }
  if (nameRows.length) await db.name.createMany({ data: nameRows });
  if (personEventRefRows.length) await db.eventRef.createMany({ data: personEventRefRows });

  // ---- Families ---------------------------------------------------------------
  const newFamilies = parsed.families.filter((f) => isNew(existing.family, f.xref));
  if (newFamilies.length) {
    await db.family.createMany({
      data: newFamilies.map((f) => ({
        treeId,
        grampsId: f.xref,
        type: f.type,
        partner1Id: f.partner1Xref ? (personMap.get(f.partner1Xref) ?? null) : null,
        partner2Id: f.partner2Xref ? (personMap.get(f.partner2Xref) ?? null) : null,
      })),
      skipDuplicates: true,
    });
  }
  const familyMap = await idMap("family", treeId);

  const childRows: Prisma.ChildRefCreateManyInput[] = [];
  const familyEventRefRows: Prisma.EventRefCreateManyInput[] = [];
  for (const f of newFamilies) {
    const familyId = familyMap.get(f.xref);
    if (!familyId) continue;
    f.children.forEach((c, i) => {
      const personId = personMap.get(c.personXref);
      if (!personId) {
        skipped++;
        return;
      }
      childRows.push({
        familyId,
        personId,
        order: i,
        partner1Relation: c.partner1Relation,
        partner2Relation: c.partner2Relation,
      });
    });
    f.eventRefs.forEach((r, i) => {
      const eventId = eventMap.get(r.eventXref);
      if (!eventId) return;
      familyEventRefRows.push({ eventId, familyId, role: eventRole(r.role, true), order: i });
    });
  }
  if (childRows.length) await db.childRef.createMany({ data: childRows, skipDuplicates: true });
  if (familyEventRefRows.length) await db.eventRef.createMany({ data: familyEventRefRows });

  // ---- Notes ---------------------------------------------------------------
  const existingNotes = new Set(
    (
      await db.note.findMany({
        where: { treeId, grampsId: { not: null } },
        select: { grampsId: true },
      })
    ).map((n) => n.grampsId),
  );
  const newNotes = parsed.notes.filter((n) => !existingNotes.has(n.xref));
  if (newNotes.length) {
    await db.note.createMany({
      data: newNotes.map((n) => ({ treeId, grampsId: n.xref, text: n.text, format: "PLAIN" as const })),
      skipDuplicates: true,
    });
  }

  if (existing.person.size > 0) {
    warnings.push(
      "This tree already had data — records whose internal id matched an existing one were skipped, not merged.",
    );
  }

  return {
    people: newPeople.length,
    families: newFamilies.length,
    events: newEvents.length,
    places: newPlaces.length,
    notes: newNotes.length,
    skipped,
    warnings,
  };
}
