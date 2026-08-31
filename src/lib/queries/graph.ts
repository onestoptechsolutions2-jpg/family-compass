import { db } from "@/lib/db";
import { displayName, NAME_SELECT, primaryName } from "@/lib/person";
import { formatDate } from "@/lib/date";

export type GraphPerson = {
  id: string;
  name: string;
  given: string;
  surname: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  living: boolean;
  /** true only when a Death or Burial event is recorded */
  deceased: boolean;
  birth: string;
  death: string;
  birthYear: number | null;
  deathYear: number | null;
};

export type TreeGraph = {
  persons: Record<string, GraphPerson>;
  /** child id -> [parent ids] */
  up: Record<string, string[]>;
  /** parent id -> [child ids] */
  down: Record<string, string[]>;
  /** person id -> [partner ids] */
  spouses: Record<string, string[]>;
  total: number;
  truncated: boolean;
};

const MAX_NODES = 4000;

/**
 * Loads the whole tree as an in-memory adjacency graph so the client tree
 * explorer can re-root instantly. Falls back to a BFS slice around `focusId`
 * for very large trees.
 */
export async function getTreeGraph(treeId: string, focusId?: string | null): Promise<TreeGraph> {
  const total = await db.person.count({ where: { treeId } });

  let personIds: Set<string> | null = null;
  let truncated = false;

  if (total > MAX_NODES && focusId) {
    personIds = await bfsSlice(treeId, focusId, MAX_NODES);
    truncated = true;
  }

  const people = await db.person.findMany({
    where: personIds ? { treeId, id: { in: [...personIds] } } : { treeId },
    select: {
      id: true,
      gender: true,
      living: true,
      names: { select: NAME_SELECT },
      eventRefs: {
        where: { event: { type: { in: ["Birth", "Death", "Burial"] } } },
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
  });

  const families = await db.family.findMany({
    where: personIds
      ? {
          treeId,
          OR: [
            { partner1Id: { in: [...personIds] } },
            { partner2Id: { in: [...personIds] } },
            { childRefs: { some: { personId: { in: [...personIds] } } } },
          ],
        }
      : { treeId },
    select: {
      partner1Id: true,
      partner2Id: true,
      childRefs: { select: { personId: true }, orderBy: { order: "asc" } },
    },
  });

  const persons: Record<string, GraphPerson> = {};
  for (const p of people) {
    const n = primaryName(p.names);
    const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event ?? null;
    const death =
      p.eventRefs.find((r) => r.event.type === "Death")?.event ??
      p.eventRefs.find((r) => r.event.type === "Burial")?.event ??
      null;
    persons[p.id] = {
      id: p.id,
      name: displayName(p.names),
      given: n?.first ?? "",
      surname: n?.surname ?? "",
      gender: p.gender,
      living: p.living,
      deceased: p.eventRefs.some((r) => r.event.type === "Death" || r.event.type === "Burial"),
      birth: birth ? formatDate(birth) : "",
      death: death ? formatDate(death) : "",
      birthYear: birth?.dateYear ?? null,
      deathYear: death?.dateYear ?? null,
    };
  }

  const up: Record<string, string[]> = {};
  const down: Record<string, string[]> = {};
  const spouses: Record<string, string[]> = {};
  const known = (id: string | null): id is string => !!id && !!persons[id];
  const link = (map: Record<string, string[]>, a: string, b: string) => {
    (map[a] ??= []).push(b);
  };

  for (const f of families) {
    const parents = [f.partner1Id, f.partner2Id].filter(known);
    if (parents.length === 2) {
      link(spouses, parents[0]!, parents[1]!);
      link(spouses, parents[1]!, parents[0]!);
    }
    for (const c of f.childRefs) {
      if (!known(c.personId)) continue;
      for (const par of parents) {
        link(up, c.personId, par);
        link(down, par, c.personId);
      }
    }
  }

  return { persons, up, down, spouses, total, truncated };
}

/** Breadth-first walk over parent/child/spouse edges from a seed person. */
async function bfsSlice(treeId: string, seedId: string, limit: number): Promise<Set<string>> {
  const visited = new Set<string>([seedId]);
  let frontier = [seedId];
  while (frontier.length && visited.size < limit) {
    const families = await db.family.findMany({
      where: {
        treeId,
        OR: [
          { partner1Id: { in: frontier } },
          { partner2Id: { in: frontier } },
          { childRefs: { some: { personId: { in: frontier } } } },
        ],
      },
      select: {
        partner1Id: true,
        partner2Id: true,
        childRefs: { select: { personId: true } },
      },
    });
    const next: string[] = [];
    for (const f of families) {
      for (const id of [f.partner1Id, f.partner2Id, ...f.childRefs.map((c) => c.personId)]) {
        if (id && !visited.has(id) && visited.size < limit) {
          visited.add(id);
          next.push(id);
        }
      }
    }
    frontier = next;
  }
  return visited;
}
