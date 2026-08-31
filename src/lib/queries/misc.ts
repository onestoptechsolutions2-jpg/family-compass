import { db } from "@/lib/db";
import { formatDate, dateSortKey } from "@/lib/date";
import { displayName, NAME_SELECT } from "@/lib/person";

export async function listEvents(treeId: string) {
  const events = await db.event.findMany({
    where: { treeId },
    select: {
      id: true,
      type: true,
      description: true,
      dateModifier: true,
      dateQuality: true,
      dateYear: true,
      dateMonth: true,
      dateDay: true,
      dateYear2: true,
      dateMonth2: true,
      dateDay2: true,
      dateText: true,
      place: { select: { title: true } },
      eventRefs: {
        select: {
          role: true,
          person: { select: { id: true, names: { select: NAME_SELECT } } },
        },
      },
    },
    take: 3000,
  });
  return events
    .map((e) => ({
      id: e.id,
      type: e.type,
      date: formatDate(e),
      sort: dateSortKey(e),
      place: e.place?.title ?? "",
      description: e.description ?? "",
      people: e.eventRefs
        .filter((r) => r.person)
        .map((r) => ({ id: r.person!.id, name: displayName(r.person!.names) })),
    }))
    .sort((a, b) => a.sort.localeCompare(b.sort));
}

export async function listPlaces(treeId: string) {
  return db.place.findMany({
    where: { treeId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      latitude: true,
      longitude: true,
      _count: { select: { events: true } },
    },
    take: 3000,
  });
}

export async function listSources(treeId: string) {
  return db.source.findMany({
    where: { treeId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      author: true,
      pubInfo: true,
      _count: { select: { citations: true } },
    },
    take: 3000,
  });
}
