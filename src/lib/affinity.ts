import type { TreeGraph } from "@/lib/queries/graph";

/**
 * Names the relationship between two people who are NOT blood relatives but are
 * connected through one or more marriages (affinal / "in-law" kin). English
 * term first, common Swahili term in brackets. Falls back to the generic
 * "shemeji" when there is no more specific word.
 *
 * Handles the common Kenyan cases, e.g. two women married to two brothers, and
 * what those women's children call each other's mothers.
 */
export type AffinityResult = {
  found: boolean;
  /** possessive chain, e.g. "A's husband's brother's wife" */
  via: string;
  /** what A calls B */
  aToB: { en: string; sw: string };
  /** what B calls A */
  bToA: { en: string; sw: string };
  note?: string;
};

type G = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
type Step = { label: "P" | "C" | "S" | "B"; to: string };

const MAX_EDGES = 4;

function siblingsOf(graph: TreeGraph, id: string): string[] {
  const out = new Set<string>();
  for (const p of graph.up[id] ?? []) for (const c of graph.down[p] ?? []) if (c !== id) out.add(c);
  return [...out];
}

function neighbours(graph: TreeGraph, id: string): Step[] {
  const steps: Step[] = [];
  for (const p of graph.up[id] ?? []) steps.push({ label: "P", to: p });
  for (const c of graph.down[id] ?? []) steps.push({ label: "C", to: c });
  for (const s of graph.spouses[id] ?? []) steps.push({ label: "S", to: s });
  for (const b of siblingsOf(graph, id)) steps.push({ label: "B", to: b });
  return steps;
}

/** Shortest labelled path A→B (fewest edges, then fewest marriages). */
function shortestPath(graph: TreeGraph, aId: string, bId: string): Step[] | null {
  const seen = new Set<string>([aId]);
  let frontier: { id: string; path: Step[] }[] = [{ id: aId, path: [] }];
  for (let depth = 0; depth < MAX_EDGES; depth++) {
    const next: typeof frontier = [];
    // fewer marriages first so "sibling's spouse" beats a longer all-blood detour
    const sorted = frontier.slice().sort((x, y) => spouseCount(x.path) - spouseCount(y.path));
    for (const node of sorted) {
      for (const step of neighbours(graph, node.id)) {
        if (seen.has(step.to)) continue;
        const path = [...node.path, step];
        if (step.to === bId) return path;
        seen.add(step.to);
        next.push({ id: step.to, path });
      }
    }
    frontier = next;
  }
  return null;
}

const spouseCount = (p: Step[]) => p.filter((s) => s.label === "S").length;

function word(label: Step["label"], g: G): string {
  if (label === "S") return g === "MALE" ? "husband" : g === "FEMALE" ? "wife" : "spouse";
  if (label === "P") return g === "MALE" ? "father" : g === "FEMALE" ? "mother" : "parent";
  if (label === "C") return g === "MALE" ? "son" : g === "FEMALE" ? "daughter" : "child";
  return g === "MALE" ? "brother" : g === "FEMALE" ? "sister" : "sibling";
}

function older(graph: TreeGraph, a: string, b: string): "a" | "b" | null {
  const ya = graph.persons[a]?.birthYear ?? null;
  const yb = graph.persons[b]?.birthYear ?? null;
  if (ya == null || yb == null) return null;
  return ya < yb ? "a" : "b";
}

export function affinalRelationship(graph: TreeGraph, aId: string, bId: string): AffinityResult {
  const none: AffinityResult = {
    found: false,
    via: "",
    aToB: { en: "no relationship found in this tree", sw: "" },
    bToA: { en: "no relationship found in this tree", sw: "" },
  };
  if (aId === bId) return none;
  if ((graph.spouses[aId] ?? []).includes(bId)) {
    const g = graph.persons[bId]?.gender ?? "UNKNOWN";
    return {
      found: true,
      via: "married to each other",
      aToB: { en: g === "MALE" ? "husband" : g === "FEMALE" ? "wife" : "spouse", sw: g === "MALE" ? "mume" : "mke" },
      bToA: { en: "spouse", sw: "mwenzi wa ndoa" },
    };
  }

  const path = shortestPath(graph, aId, bId);
  if (!path || spouseCount(path) === 0) return none;

  const labels = path.map((s) => s.label).join("");
  const bG = (graph.persons[bId]?.gender ?? "UNKNOWN") as G;

  // human-readable chain: "A's <w1>'s <w2>'s ..."
  const chain = path
    .map((s) => word(s.label, (graph.persons[s.to]?.gender ?? "UNKNOWN") as G))
    .join("'s ");
  const via = `A's ${chain}`;

  const mkFF = bG === "FEMALE";
  const set = (en: string, sw: string, benEn: string, benSw: string, note?: string): AffinityResult => ({
    found: true,
    via,
    aToB: { en, sw },
    bToA: { en: benEn, sw: benSw },
    note,
  });

  switch (labels) {
    case "SP": // spouse's parent
      return set(
        mkFF ? "mother-in-law" : "father-in-law",
        "mkwe (mama/baba mkwe)",
        "child-in-law",
        "mkwe",
      );
    case "PS": // parent's (other) spouse — step-parent
      return set(
        mkFF ? "step-mother" : "step-father",
        mkFF ? "mama wa kambo" : "baba wa kambo",
        "step-child",
        "mtoto wa kambo",
      );
    case "SC": // spouse's child from another union — step-child
      return set(
        mkFF ? "step-daughter" : "step-son",
        "mtoto wa kambo",
        mkFF ? "step-mother" : "step-father",
        "mzazi wa kambo",
      );
    case "CS": // child's spouse
      return set(
        mkFF ? "daughter-in-law" : "son-in-law",
        "mkwe",
        mkFF ? "mother-in-law" : "father-in-law",
        "mkwe",
      );
    case "SB": // spouse's sibling
    case "SPC":
      return set(
        mkFF ? "sister-in-law" : "brother-in-law",
        mkFF ? "wifi (shemeji)" : "shemeji",
        "sibling-in-law",
        "shemeji",
      );
    case "BS": // sibling's spouse
    case "PCS":
      return set(
        mkFF ? "sister-in-law" : "brother-in-law",
        "shemeji",
        "sibling-in-law",
        "shemeji",
      );
    case "SS": // co-spouse (polygynous)
      return set(
        mkFF ? "co-wife" : "co-husband",
        mkFF ? "mke mwenza" : "mume mwenza",
        "co-spouse",
        "mwenza",
        "They share a spouse.",
      );
    case "SBS": // spouse's sibling's spouse — e.g. two women married to two brothers
    case "SPCS":
    case "BSS":
      return set(
        mkFF ? "sister-in-law (married to your spouse's sibling)" : "brother-in-law (married to your spouse's sibling)",
        mkFF ? "wifi (shemeji)" : "shemeji",
        "co-in-law",
        "shemeji",
        "Their spouses are siblings — e.g. they married two brothers, so they are shemeji to each other; colloquially wifi between women.",
      );
    case "PBS": // parent's sibling's spouse — uncle/aunt by marriage (classificatory parent)
    case "PPCS": {
      const parent = path[0]!.to;
      const auntUncle = path[1]!.to;
      const rank = older(graph, auntUncle, parent);
      const size = rank === "a" ? "mkubwa" : rank === "b" ? "mdogo" : "mdogo/mkubwa";
      return set(
        mkFF ? "aunt (by marriage)" : "uncle (by marriage)",
        mkFF ? `mama ${size}` : `baba ${size}`,
        mkFF ? "niece/nephew" : "niece/nephew",
        "mpwa",
        "In most Kenyan communities a parent's brother's wife is addressed as a mother (mama mkubwa/mdogo).",
      );
    }
    case "SBC": // spouse's sibling's child — niece/nephew by marriage
    case "SPCC":
      return set(
        "niece/nephew (by marriage)",
        "mpwa",
        mkFF ? "aunt (by marriage)" : "uncle (by marriage)",
        mkFF ? "shangazi/mama" : "baba mdogo/mkubwa",
      );
    default:
      return set(
        "related by marriage",
        "shemeji",
        "related by marriage",
        "shemeji",
        `Connected as: ${via.replace(/^A's /, "")}.`,
      );
  }
}
