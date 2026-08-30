import { hierarchy, tree } from "d3-hierarchy";

import type { TreeGraph } from "@/lib/queries/graph";

export const CARD_W = 190;
export const CARD_H = 66;
const GAP_X = 26;
const GAP_Y = 64;

export type Mode = "ancestors" | "hourglass" | "descendants";

export type PositionedNode = {
  key: string;
  personId: string;
  x: number;
  y: number;
  role: "center" | "ancestor" | "descendant" | "spouse";
  generation: number;
};

export type Edge = { id: string; x1: number; y1: number; x2: number; y2: number; kind: "lineage" | "couple" };

export type Layout = {
  nodes: PositionedNode[];
  edges: Edge[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

type HierNode = { key: string; personId: string; children: HierNode[] };

function buildUp(graph: TreeGraph, rootId: string, maxGen: number): HierNode {
  const make = (id: string, keyPrefix: string, gen: number, seen: Set<string>): HierNode => {
    const key = `${keyPrefix}${id}`;
    const node: HierNode = { key, personId: id, children: [] };
    if (gen >= maxGen || seen.has(id)) return node;
    const next = new Set(seen).add(id);
    for (const parent of graph.up[id] ?? []) {
      node.children.push(make(parent, `${key}/`, gen + 1, next));
    }
    return node;
  };
  return make(rootId, "", 0, new Set());
}

function buildDown(graph: TreeGraph, rootId: string, maxGen: number): HierNode {
  const make = (id: string, keyPrefix: string, gen: number, seen: Set<string>): HierNode => {
    const key = `${keyPrefix}${id}`;
    const node: HierNode = { key, personId: id, children: [] };
    if (gen >= maxGen || seen.has(id)) return node;
    const next = new Set(seen).add(id);
    for (const child of graph.down[id] ?? []) {
      node.children.push(make(child, `${key}/`, gen + 1, next));
    }
    return node;
  };
  return make(rootId, "", 0, new Set());
}

function layoutSide(rootNode: HierNode, direction: 1 | -1) {
  const layoutFn = tree<HierNode>()
    .nodeSize([CARD_W + GAP_X, CARD_H + GAP_Y])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.25));
  const root = layoutFn(hierarchy<HierNode>(rootNode, (d) => d.children));

  const nodes = root.descendants().map((d) => ({
    key: d.data.key,
    personId: d.data.personId,
    x: d.x,
    y: d.y * direction,
    depth: d.depth,
    parentKey: d.parent?.data.key ?? null,
  }));
  return { rootX: root.x, nodes };
}

export function computeLayout(graph: TreeGraph, centerId: string, mode: Mode, gens: number): Layout {
  const upGen = mode === "descendants" ? 0 : gens;
  const downGen = mode === "ancestors" ? 0 : gens;

  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];
  const placed = new Map<string, PositionedNode>();

  const add = (n: PositionedNode) => {
    if (placed.has(n.key)) return;
    placed.set(n.key, n);
    nodes.push(n);
  };

  // center
  add({ key: centerId, personId: centerId, x: 0, y: 0, role: "center", generation: 0 });

  // descendants (downward, +y)
  if (downGen > 0) {
    const down = layoutSide(buildDown(graph, centerId, downGen), 1);
    const shift = -down.rootX;
    for (const n of down.nodes) {
      if (n.depth === 0) continue;
      add({
        key: n.key,
        personId: n.personId,
        x: n.x + shift,
        y: n.y,
        role: "descendant",
        generation: n.depth,
      });
    }
    for (const n of down.nodes) {
      if (n.depth === 0 || !n.parentKey) continue;
      const parent = placed.get(n.parentKey) ?? placed.get(centerId)!;
      const self = placed.get(n.key)!;
      edges.push({
        id: `d-${n.key}`,
        x1: parent.x,
        y1: parent.y,
        x2: self.x,
        y2: self.y,
        kind: "lineage",
      });
    }
  }

  // ancestors (upward, -y)
  if (upGen > 0) {
    const up = layoutSide(buildUp(graph, centerId, upGen), -1);
    const shift = -up.rootX;
    for (const n of up.nodes) {
      if (n.depth === 0) continue;
      add({
        key: n.key,
        personId: n.personId,
        x: n.x + shift,
        y: n.y,
        role: "ancestor",
        generation: n.depth,
      });
    }
    for (const n of up.nodes) {
      if (n.depth === 0 || !n.parentKey) continue;
      const child = placed.get(n.parentKey) ?? placed.get(centerId)!;
      const self = placed.get(n.key)!;
      edges.push({
        id: `a-${n.key}`,
        x1: child.x,
        y1: child.y,
        x2: self.x,
        y2: self.y,
        kind: "lineage",
      });
    }
  }

  // spouse(s) of center — sit beside, connected by a couple bar
  const spouseIds = graph.spouses[centerId] ?? [];
  spouseIds.slice(0, 2).forEach((sid, i) => {
    if (!graph.persons[sid]) return;
    const key = `spouse/${sid}`;
    const x = (i + 1) * (CARD_W + GAP_X);
    add({ key, personId: sid, x, y: 0, role: "spouse", generation: 0 });
    edges.push({ id: `c-${sid}`, x1: 0, y1: 0, x2: x, y2: 0, kind: "couple" });
  });

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const bounds = {
    minX: Math.min(...xs) - CARD_W / 2,
    maxX: Math.max(...xs) + CARD_W / 2,
    minY: Math.min(...ys) - CARD_H / 2,
    maxY: Math.max(...ys) + CARD_H / 2,
  };

  return { nodes, edges, bounds };
}

/** Smooth S-curve between two node centers (vertical flow). */
export function linkPath(e: Edge): string {
  if (e.kind === "couple") {
    return `M${e.x1 + CARD_W / 2},${e.y1} L${e.x2 - CARD_W / 2},${e.y2}`;
  }
  const midY = (e.y1 + e.y2) / 2;
  return `M${e.x1},${e.y1} C${e.x1},${midY} ${e.x2},${midY} ${e.x2},${e.y2}`;
}
