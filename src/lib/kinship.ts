import type { TreeGraph } from "@/lib/queries/graph";

export type Kinship = {
  samePerson: boolean;
  marriedToEachOther: boolean;
  related: boolean;
  commonAncestorId: string | null;
  degreeA: number;
  degreeB: number;
  label: string;
  /** rough "closeness"; lower = closer. -1 when unrelated */
  closeness: number;
};

function ancestorDistances(graph: TreeGraph, start: string): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  let frontier = [start];
  let depth = 0;
  while (frontier.length && depth < 30) {
    depth++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const parent of graph.up[id] ?? []) {
        if (!dist.has(parent)) {
          dist.set(parent, depth);
          next.push(parent);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

const ANC = ["", "parent", "grandparent", "great-grandparent", "2×great-grandparent", "3×great-grandparent"];
function ancestorWord(n: number): string {
  return ANC[n] ?? `${n - 1}×great-grandparent`;
}
const ORD = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
function ordinal(n: number): string {
  return ORD[n] ?? `${n}th`;
}

export function bloodRelationship(graph: TreeGraph, aId: string, bId: string): Kinship {
  const base: Kinship = {
    samePerson: aId === bId,
    marriedToEachOther: (graph.spouses[aId] ?? []).includes(bId),
    related: false,
    commonAncestorId: null,
    degreeA: 0,
    degreeB: 0,
    label: "no blood relationship found in this tree",
    closeness: -1,
  };
  if (aId === bId) return { ...base, label: "the same person", related: true, closeness: 0 };

  const da = ancestorDistances(graph, aId);
  const db = ancestorDistances(graph, bId);

  let best: { id: string; a: number; b: number } | null = null;
  for (const [id, a] of da) {
    const b = db.get(id);
    if (b === undefined) continue;
    if (id === aId || id === bId) {
      // direct line
      best = { id, a, b };
      break;
    }
    if (!best || a + b < best.a + best.b) best = { id, a, b };
  }
  if (!best) return base;

  const { id, a, b } = best;
  let label: string;
  if (a === 0) {
    label = `${ancestorWord(b)} and descendant`;
  } else if (b === 0) {
    label = `${ancestorWord(a)} and descendant`;
  } else if (a === 1 && b === 1) {
    label = "siblings";
  } else {
    const cousinDegree = Math.min(a, b) - 1;
    const removed = Math.abs(a - b);
    label =
      cousinDegree === 0
        ? removed === 1
          ? "aunt/uncle and niece/nephew"
          : `${removed}× removed aunt/uncle`
        : `${ordinal(cousinDegree)} cousins${removed ? `, ${removed === 1 ? "once" : removed === 2 ? "twice" : `${removed}×`} removed` : ""}`;
  }

  return {
    ...base,
    related: true,
    commonAncestorId: id,
    degreeA: a,
    degreeB: b,
    label,
    closeness: a + b,
  };
}
