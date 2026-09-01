import type { Prisma } from "@prisma/client";

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
  /** immediate connecting people — the "key nodes" around this person */
  parents: string[];
  spouses: string[];
  /** why this row matched the search: "name" | "parent" | "spouse" */
  matchedVia: "name" | "parent" | "spouse" | null;
};

/** name-contains filter reused for the person and their relatives */
function nameMatch(q: string) {
  return {
    some: {
      OR: [
        { first: { contains: q, mode: "insensitive" as const } },
        { surname: { contains: q, mode: "insensitive" as const } },
      ],
    },
  };
}

export async function listPeople(treeId: string, q?: string): Promise<PersonListRow[]> {
  const people = await db.person.findMany({
    where: {
      treeId,
      ...(q
        ? {
            OR: [
              { names: nameMatch(q) },
              // child of a family where either parent's name matches
              {
                childRefs: {
                  some: {
                    family: {
                      OR: [
                        { partner1: { is: { names: nameMatch(q) } } },
                        { partner2: { is: { names: nameMatch(q) } } },
                      ],
                    },
                  },
                },
              },
              // partnered with someone whose name matches
              { familiesAsPartner1: { some: { partner2: { is: { names: nameMatch(q) } } } } },
              { familiesAsPartner2: { some: { partner1: { is: { names: nameMatch(q) } } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      gender: true,
      living: true,
      names: { select: NAME_SELECT },
      childRefs: {
        take: 1,
        select: {
          family: {
            select: {
              partner1: { select: { names: { select: NAME_SELECT } } },
              partner2: { select: { names: { select: NAME_SELECT } } },
            },
          },
        },
      },
      familiesAsPartner1: {
        select: { partner2: { select: { names: { select: NAME_SELECT } } } },
      },
      familiesAsPartner2: {
        select: { partner1: { select: { names: { select: NAME_SELECT } } } },
      },
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

  const ql = q?.toLowerCase().trim() ?? "";
  const hit = (n: string) => !!ql && n.toLowerCase().includes(ql);

  const rows = people.map((p) => {
    const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event;
    const death = p.eventRefs.find((r) => r.event.type === "Death")?.event;
    const deceased = p.eventRefs.some((r) => r.event.type === "Death" || r.event.type === "Burial");

    const parentFam = p.childRefs[0]?.family;
    const parents = [parentFam?.partner1, parentFam?.partner2]
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => displayName(x.names));
    const spouses = [
      ...p.familiesAsPartner1.map((f) => f.partner2),
      ...p.familiesAsPartner2.map((f) => f.partner1),
    ]
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => displayName(x.names));

    const name = displayName(p.names);
    const matchedVia: PersonListRow["matchedVia"] = !ql
      ? null
      : hit(name)
        ? "name"
        : parents.some(hit)
          ? "parent"
          : spouses.some(hit)
            ? "spouse"
            : null;

    return {
      id: p.id,
      name,
      sortKey: sortableName(p.names),
      gender: p.gender,
      living: p.living,
      deceased,
      birth: birth ? formatDate(birth) : "",
      death: death ? formatDate(death) : "",
      parents,
      spouses,
      matchedVia,
    };
  });
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows;
}

const PERSON_DETAIL_BASE = {
  id: true,
  grampsId: true,
  gender: true,
  living: true,
  privacy: true,
  publicDatePrecision: true,
  hidePhotosPublic: true,
  phone: true,
  claimedByUserId: true,
  claimedBy: { select: { name: true } },
  clanId: true,
  subClan: true,
  clan: { select: { name: true } },
} satisfies Prisma.PersonSelect;

const PERSON_DETAIL_NAMING = {
  namedAfterId: true,
  namedAfter: { select: { id: true, names: { select: NAME_SELECT } } },
  namesakes: { select: { id: true, names: { select: NAME_SELECT } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.PersonSelect;

export async function getPersonDetail(treeId: string, personId: string) {
  // The naming fields (migration …037) are additive — if a deploy hasn't run
  // migrations yet, fall back so every person page doesn't 500 on a missing
  // column. Check /api/health?schema=1 when this fallback fires in prod.
  const rest = {
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
  } satisfies Prisma.PersonSelect;

  try {
    return await db.person.findFirst({
      where: { id: personId, treeId },
      select: { ...PERSON_DETAIL_BASE, ...PERSON_DETAIL_NAMING, ...rest },
    });
  } catch {
    const base = await db.person.findFirst({
      where: { id: personId, treeId },
      select: { ...PERSON_DETAIL_BASE, ...rest },
    });
    return base
      ? {
          ...base,
          namedAfterId: null as string | null,
          namedAfter: null as { id: string; names: (typeof base.names) } | null,
          namesakes: [] as { id: string; names: typeof base.names }[],
        }
      : null;
  }
}

const PERSON_MINI = {
  id: true,
  gender: true,
  living: true,
  claimedByUserId: true,
  names: { select: NAME_SELECT },
  eventRefs: {
    where: { event: { is: { type: { in: ["Death", "Burial"] } } } },
    select: { id: true },
  },
} satisfies Prisma.PersonSelect;

type MiniPerson = {
  id: string;
  living: boolean;
  claimedByUserId: string | null;
  eventRefs: { id: string }[];
  names: Parameters<typeof displayName>[0];
};

/** Living, unclaimed relatives from a getPersonRelations() result — the ones
 *  a claim link can still be sent to. Deduped by id. */
export function claimableRelatives(
  relations: Awaited<ReturnType<typeof getPersonRelations>>,
): { id: string; name: string; tie: string }[] {
  if (!relations) return [];
  const seen = new Set<string>();
  const out: { id: string; name: string; tie: string }[] = [];
  const add = (p: MiniPerson | null | undefined, tie: string) => {
    if (!p || seen.has(p.id)) return;
    if (!p.living || p.claimedByUserId || p.eventRefs.length > 0) return;
    seen.add(p.id);
    out.push({ id: p.id, name: displayName(p.names), tie });
  };
  relations.parents.forEach((p) => add(p as MiniPerson, "parent"));
  relations.siblings.forEach((p) => add(p as MiniPerson, "sibling"));
  relations.halfSiblings.forEach((p) => add(p as MiniPerson, "half-sibling"));
  relations.stepParents.forEach((p) => add(p as MiniPerson, "step-parent"));
  relations.stepSiblings.forEach((p) => add(p as MiniPerson, "step-sibling"));
  relations.stepChildren.forEach((p) => add(p as MiniPerson, "step-child"));
  relations.families.forEach((f) => {
    add(f.spouse as MiniPerson | null, "spouse");
    f.children.forEach((c) => add(c as MiniPerson, "child"));
  });
  return out;
}

const FAMILY_FULL = {
  id: true,
  type: true,
  partner1Id: true,
  partner2Id: true,
  partner1: { select: PERSON_MINI },
  partner2: { select: PERSON_MINI },
  childRefs: { select: { person: { select: PERSON_MINI } }, orderBy: { order: "asc" } },
} satisfies Prisma.FamilySelect;

type RelPerson = Prisma.PersonGetPayload<{ select: typeof PERSON_MINI }>;

/** Parents, siblings (full / half / step), partners, children and step-children
 *  for the person detail view. */
export async function getPersonRelations(treeId: string, personId: string) {
  const [asChild, spouseFamilies] = await Promise.all([
    db.childRef.findMany({
      where: { personId, family: { treeId } },
      orderBy: { family: { createdAt: "asc" } },
      select: { family: { select: FAMILY_FULL } },
    }),
    db.family.findMany({
      where: { treeId, OR: [{ partner1Id: personId }, { partner2Id: personId }] },
      select: FAMILY_FULL,
    }),
  ]);
  const parentFamilies = asChild.map((c) => c.family);
  if (parentFamilies.length === 0 && spouseFamilies.length === 0) {
    // still return a valid shape (person exists but is unconnected)
    const exists = await db.person.findFirst({ where: { id: personId, treeId }, select: { id: true } });
    if (!exists) return null;
  }

  const parentFamilyIds = new Set(parentFamilies.map((f) => f.id));
  const parentIds = [
    ...new Set(parentFamilies.flatMap((f) => [f.partner1Id, f.partner2Id]).filter((x): x is string => !!x)),
  ];
  const isParent = (id?: string | null): id is string => !!id && parentIds.includes(id);

  const primary = parentFamilies[0] ?? null;
  const parents = primary
    ? [primary.partner1, primary.partner2].filter((p): p is NonNullable<typeof p> => !!p)
    : [];

  // Families that any parent is a partner in → full & half siblings, step-parents.
  const parentUnions = parentIds.length
    ? await db.family.findMany({
        where: {
          treeId,
          OR: [{ partner1Id: { in: parentIds } }, { partner2Id: { in: parentIds } }],
        },
        select: FAMILY_FULL,
      })
    : [];

  const fullSibs = new Map<string, RelPerson>();
  const halfSibs = new Map<string, RelPerson>();
  const stepParents = new Map<string, RelPerson>();
  for (const f of parentUnions) {
    const p1 = isParent(f.partner1Id);
    const p2 = isParent(f.partner2Id);
    if (parentFamilyIds.has(f.id)) {
      for (const c of f.childRefs) if (c.person.id !== personId) fullSibs.set(c.person.id, c.person);
    } else if (p1 || p2) {
      for (const c of f.childRefs) if (c.person.id !== personId) halfSibs.set(c.person.id, c.person);
      const other = p1 ? f.partner2 : f.partner1;
      if (other && !isParent(other.id)) stepParents.set(other.id, other);
    }
  }

  // Families a step-parent is in, where the other partner is NOT one of my
  // parents → step-siblings (connected only through the step-parent).
  const stepSibs = new Map<string, RelPerson>();
  const stepParentIds = [...stepParents.keys()];
  if (stepParentIds.length) {
    const stepUnions = await db.family.findMany({
      where: {
        treeId,
        OR: [{ partner1Id: { in: stepParentIds } }, { partner2Id: { in: stepParentIds } }],
      },
      select: FAMILY_FULL,
    });
    for (const f of stepUnions) {
      const spIsP1 = stepParents.has(f.partner1Id ?? "");
      const other = spIsP1 ? f.partner2Id : f.partner1Id;
      if (isParent(other)) continue; // half-sibling family, already counted
      for (const c of f.childRefs) {
        const id = c.person.id;
        if (id === personId || fullSibs.has(id) || halfSibs.has(id)) continue;
        stepSibs.set(id, c.person);
      }
    }
  }

  // Step-children: children in a partner's *other* unions that aren't ours.
  const myFamilyIds = new Set(spouseFamilies.map((f) => f.id));
  const spouseIds = [
    ...new Set(
      spouseFamilies
        .map((f) => (f.partner1?.id === personId ? f.partner2?.id : f.partner1?.id))
        .filter((x): x is string => !!x),
    ),
  ];
  const myChildIds = new Set(spouseFamilies.flatMap((f) => f.childRefs.map((c) => c.person.id)));
  const stepChildren = new Map<string, RelPerson>();
  if (spouseIds.length) {
    const spouseUnions = await db.family.findMany({
      where: { treeId, OR: [{ partner1Id: { in: spouseIds } }, { partner2Id: { in: spouseIds } }] },
      select: FAMILY_FULL,
    });
    for (const f of spouseUnions) {
      if (myFamilyIds.has(f.id)) continue;
      for (const c of f.childRefs) {
        if (c.person.id === personId || myChildIds.has(c.person.id)) continue;
        stepChildren.set(c.person.id, c.person);
      }
    }
  }

  return {
    parents,
    siblings: [...fullSibs.values()],
    halfSiblings: [...halfSibs.values()],
    stepParents: [...stepParents.values()],
    stepSiblings: [...stepSibs.values()],
    stepChildren: [...stepChildren.values()],
    parentFamily: primary
      ? { id: primary.id, hasFather: !!primary.partner1Id, hasMother: !!primary.partner2Id }
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
