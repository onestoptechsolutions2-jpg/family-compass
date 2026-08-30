import { db } from "@/lib/db";
import { displayName, sortableName } from "@/lib/person";
import { formatDate } from "@/lib/date";

const NAME_SELECT = {
  id: true,
  type: true,
  preferred: true,
  order: true,
  title: true,
  prefix: true,
  first: true,
  nick: true,
  callName: true,
  surnamePrefix: true,
  surname: true,
  suffix: true,
} as const;

export type PersonListRow = {
  id: string;
  name: string;
  sortKey: string;
  gender: string;
  living: boolean;
  deceased: boolean;
  birth: string;
  death: string;
};

export async function listPeople(treeId: string, q?: string): Promise<PersonListRow[]> {
  const people = await db.person.findMany({
    where: {
      treeId,
      ...(q
        ? {
            names: {
              some: {
                OR: [
                  { first: { contains: q, mode: "insensitive" } },
                  { surname: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      gender: true,
      living: true,
      names: { select: NAME_SELECT },
      eventRefs: {
        where: { role: "PRIMARY", event: { type: { in: ["Birth", "Death", "Burial"] } } },
        select: {
          event: {
            select: {
              type: true,
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
          },
        },
      },
    },
    take: 2000,
  });

  const rows = people.map((p) => {
    const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event;
    const death = p.eventRefs.find((r) => r.event.type === "Death")?.event;
    const deceased = p.eventRefs.some((r) => r.event.type === "Death" || r.event.type === "Burial");
    return {
      id: p.id,
      name: displayName(p.names),
      sortKey: sortableName(p.names),
      gender: p.gender,
      living: p.living,
      deceased,
      birth: birth ? formatDate(birth) : "",
      death: death ? formatDate(death) : "",
    };
  });
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows;
}

export async function getPersonDetail(treeId: string, personId: string) {
  return db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      id: true,
      grampsId: true,
      gender: true,
      living: true,
      privacy: true,
      phone: true,
      claimedByUserId: true,
      claimedBy: { select: { name: true } },
      clanId: true,
      subClan: true,
      clan: { select: { name: true } },
      names: { select: NAME_SELECT, orderBy: { order: "asc" } },
      attributes: { select: { id: true, type: true, value: true }, orderBy: { order: "asc" } },
      eventRefs: {
        select: {
          id: true,
          role: true,
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
              place: { select: { id: true, title: true } },
            },
          },
        },
      },
      familiesAsPartner1: { select: { id: true } },
      familiesAsPartner2: { select: { id: true } },
      childRefs: { select: { id: true, familyId: true } },
    },
  });
}

const PERSON_MINI = {
  id: true,
  gender: true,
  living: true,
  names: { select: NAME_SELECT },
} as const;

/** Parents, siblings, partners and children for the person detail view. */
export async function getPersonRelations(treeId: string, personId: string) {
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      id: true,
      childRefs: {
        select: {
          family: {
            select: {
              id: true,
              partner1Id: true,
              partner2Id: true,
              partner1: { select: PERSON_MINI },
              partner2: { select: PERSON_MINI },
              childRefs: {
                select: { person: { select: PERSON_MINI } },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
      familiesAsPartner1: { select: { id: true } },
      familiesAsPartner2: { select: { id: true } },
    },
  });
  if (!person) return null;

  const spouseFamilies = await db.family.findMany({
    where: {
      treeId,
      OR: [{ partner1Id: personId }, { partner2Id: personId }],
    },
    select: {
      id: true,
      type: true,
      partner1: { select: PERSON_MINI },
      partner2: { select: PERSON_MINI },
      childRefs: {
        select: { person: { select: PERSON_MINI } },
        orderBy: { order: "asc" },
      },
    },
  });

  const parentFamily = person.childRefs[0]?.family ?? null;
  const parents = parentFamily
    ? [parentFamily.partner1, parentFamily.partner2].filter((p): p is NonNullable<typeof p> => !!p)
    : [];
  const siblings = parentFamily
    ? parentFamily.childRefs.map((c) => c.person).filter((p) => p.id !== personId)
    : [];

  return {
    parents,
    siblings,
    parentFamily: parentFamily
      ? {
          id: parentFamily.id,
          hasFather: !!parentFamily.partner1Id,
          hasMother: !!parentFamily.partner2Id,
        }
      : null,
    families: spouseFamilies.map((f) => {
      const spouse = f.partner1?.id === personId ? f.partner2 : f.partner1;
      return { id: f.id, type: f.type, spouse, children: f.childRefs.map((c) => c.person) };
    }),
  };
}

/** Minimal id+name list for pickers (partners, children, central person). */
export async function personOptions(treeId: string) {
  const people = await db.person.findMany({
    where: { treeId },
    select: { id: true, gender: true, names: { select: NAME_SELECT } },
    take: 5000,
  });
  return people
    .map((p) => ({ id: p.id, gender: p.gender, label: displayName(p.names), sortKey: sortableName(p.names) }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
