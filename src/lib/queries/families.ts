import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";

const PERSON_MINI = { id: true, gender: true, living: true, names: { select: NAME_SELECT } } as const;

export async function listFamilies(treeId: string) {
  const families = await db.family.findMany({
    where: { treeId },
    select: {
      id: true,
      type: true,
      partner1: { select: PERSON_MINI },
      partner2: { select: PERSON_MINI },
      _count: { select: { childRefs: true } },
    },
    take: 2000,
  });
  return families
    .map((f) => ({
      id: f.id,
      type: f.type,
      label: `${f.partner1 ? displayName(f.partner1.names) : "?"} + ${
        f.partner2 ? displayName(f.partner2.names) : "?"
      }`,
      children: f._count.childRefs,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getFamilyDetail(treeId: string, familyId: string) {
  return db.family.findFirst({
    where: { id: familyId, treeId },
    select: {
      id: true,
      type: true,
      grampsId: true,
      partner1: { select: PERSON_MINI },
      partner2: { select: PERSON_MINI },
      partner1Id: true,
      partner2Id: true,
      childRefs: {
        orderBy: { order: "asc" },
        select: { id: true, person: { select: PERSON_MINI } },
      },
      eventRefs: {
        select: {
          event: {
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
            },
          },
        },
      },
    },
  });
}
