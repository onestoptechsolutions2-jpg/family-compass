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

const g = (male: string, female: string, neutral: string, gender?: string | null) =>
  gender === "MALE" ? male : gender === "FEMALE" ? female : neutral;

/**
 * A short directional term for what `subject` (degreeA up to the common
 * ancestor) is to the other person (degreeB up). e.g. "grandson", "aunt",
 * "sister". Returns null when not blood-related.
 */
export function kinTermToward(k: Kinship, subjectGender?: string | null): string | null {
  if (k.samePerson) return "the same person";
  if (!k.related) return null;
  const a = k.degreeA;
  const b = k.degreeB;
  const greats = (n: number) => (n <= 0 ? "" : n === 1 ? "great-" : `${n}×great-`);

  if (a === 0) {
    if (b === 1) return g("father", "mother", "parent", subjectGender);
    return `${greats(b - 2)}${g("grandfather", "grandmother", "grandparent", subjectGender)}`;
  }
  if (b === 0) {
    if (a === 1) return g("son", "daughter", "child", subjectGender);
    return `${greats(a - 2)}${g("grandson", "granddaughter", "grandchild", subjectGender)}`;
  }
  if (a === 1 && b === 1) return g("brother", "sister", "sibling", subjectGender);
  if (a === 1 && b >= 2) return `${greats(b - 2)}${g("uncle", "aunt", "aunt or uncle", subjectGender)}`;
  if (b === 1 && a >= 2) return `${greats(a - 2)}${g("nephew", "niece", "niece or nephew", subjectGender)}`;
  const cousinDegree = Math.min(a, b) - 1;
  const removed = Math.abs(a - b);
  return `${["first", "second", "third", "fourth", "fifth"][cousinDegree] ?? `${cousinDegree + 1}th`} cousin${
    removed ? ` ${removed === 1 ? "once" : removed === 2 ? "twice" : `${removed}×`} removed` : ""
  }`;
}
