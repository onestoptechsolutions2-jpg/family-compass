import { db } from "@/lib/db";

export async function loadTreeForExport(treeId: string) {
  const [tree, people, families, events, places, notes] = await Promise.all([
    db.tree.findUniqueOrThrow({ where: { id: treeId }, select: { name: true } }),
    db.person.findMany({
      where: { treeId },
      select: {
        id: true,
        gender: true,
        living: true,
        names: {
          orderBy: { order: "asc" },
          select: {
            type: true,
            preferred: true,
            first: true,
            nick: true,
            surname: true,
            surnamePrefix: true,
            suffix: true,
            title: true,
          },
        },
        eventRefs: { select: { eventId: true, role: true } },
      },
    }),
    db.family.findMany({
      where: { treeId },
      select: {
        id: true,
        type: true,
        partner1Id: true,
        partner2Id: true,
        childRefs: {
          orderBy: { order: "asc" },
          select: { personId: true, partner1Relation: true, partner2Relation: true },
        },
        eventRefs: { select: { eventId: true } },
      },
    }),
    db.event.findMany({
      where: { treeId },
      select: {
        id: true,
        type: true,
        description: true,
        placeId: true,
        dateModifier: true,
        dateQuality: true,
        dateYear: true,
        dateMonth: true,
        dateDay: true,
        dateYear2: true,
        dateMonth2: true,
        dateDay2: true,
        dateText: true,
      },
    }),
    db.place.findMany({
      where: { treeId },
      select: { id: true, title: true, latitude: true, longitude: true },
    }),
    db.note.findMany({ where: { treeId }, select: { id: true, text: true, type: true } }),
  ]);

  return { tree, people, families, events, places, notes };
}

export type ExportData = Awaited<ReturnType<typeof loadTreeForExport>>;
export type ExportEvent = ExportData["events"][number];
