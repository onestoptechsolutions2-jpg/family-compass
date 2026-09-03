import { db } from "@/lib/db";
import { getTreeGraph, type TreeGraph } from "@/lib/queries/graph";

const MAX_TREES = 8;

/**
 * Stitches together every tree reachable from `seedTreeId` through a CONFIRMED
 * marriage bridge (IdentityRelationship kind=MARRIAGE) into one combined
 * TreeGraph, so the existing single-tree engines — bloodRelationship,
 * affinalRelationship — can walk paths that cross family lines, e.g. "how is
 * my niece related to my wife's father." Nothing is written anywhere; this is
 * a read-only, in-memory join for one relationship check.
 *
 * Trees other than the seed aren't ones the viewer is necessarily a member
 * of, so they're sanitized the same way connectedFamilyAcrossTrees is:
 * PRIVATE people dropped entirely (a broken bridge is the correct failure
 * mode, not a leak), REDACTED people kept as structural nodes but shown
 * nameless. Only a CONFIRMED marriage ever bridges trees — PROPOSED/DISPUTED
 * links stay invisible here exactly as they do everywhere else.
 */
export async function buildCrossTreeGraph(
  seedTreeId: string,
): Promise<{ graph: TreeGraph; treeIds: string[]; personTree: Record<string, string>; treeNames: Record<string, string> }> {
  const combined: TreeGraph = { persons: {}, up: {}, down: {}, spouses: {}, total: 0, truncated: false };
  const included = new Set<string>();
  const personTree: Record<string, string> = {};
  let frontier = [seedTreeId];

  const merge = (treeId: string, g: TreeGraph) => {
    Object.assign(combined.persons, g.persons);
    for (const id of Object.keys(g.persons)) personTree[id] = treeId;
    for (const [k, v] of Object.entries(g.up)) (combined.up[k] ??= []).push(...v);
    for (const [k, v] of Object.entries(g.down)) (combined.down[k] ??= []).push(...v);
    for (const [k, v] of Object.entries(g.spouses)) (combined.spouses[k] ??= []).push(...v);
    combined.total += g.total;
    combined.truncated = combined.truncated || g.truncated;
  };

  while (frontier.length && included.size < MAX_TREES) {
    const treeId = frontier.shift()!;
    if (included.has(treeId)) continue;
    included.add(treeId);

    const raw = await getTreeGraph(treeId);
    merge(treeId, treeId === seedTreeId ? raw : await sanitizeForeignGraph(treeId, raw));

    const linked = await db.person.findMany({
      where: { treeId, id: { in: Object.keys(raw.persons) }, identityId: { not: null } },
      select: { identityId: true },
      distinct: ["identityId"],
    });
    const identityIds = linked.map((p) => p.identityId!).filter(Boolean);
    if (identityIds.length === 0) continue;

    const rels = await db.identityRelationship.findMany({
      where: {
        kind: "MARRIAGE",
        status: "CONFIRMED",
        OR: [{ aIdentityId: { in: identityIds } }, { bIdentityId: { in: identityIds } }],
      },
      select: { aIdentityId: true, bIdentityId: true },
    });
    if (rels.length === 0) continue;

    const bridgeIdentityIds = new Set<string>();
    for (const r of rels) {
      if (identityIds.includes(r.aIdentityId)) bridgeIdentityIds.add(r.bIdentityId);
      if (identityIds.includes(r.bIdentityId)) bridgeIdentityIds.add(r.aIdentityId);
    }
    const otherTrees = await db.person.findMany({
      where: { identityId: { in: [...bridgeIdentityIds] } },
      select: { treeId: true },
      distinct: ["treeId"],
    });
    for (const t of otherTrees) if (!included.has(t.treeId) && !frontier.includes(t.treeId)) frontier.push(t.treeId);
  }

  // Add the spouse edges the bridges themselves represent — the whole reason
  // a niece in one tree and a father-in-law in another end up connected.
  const allPeople = await db.person.findMany({
    where: { id: { in: Object.keys(combined.persons) }, identityId: { not: null } },
    select: { id: true, identityId: true, privacy: true },
  });
  const byIdentity = new Map<string, string[]>();
  for (const p of allPeople) {
    if (p.privacy === "PRIVATE") continue;
    const list = byIdentity.get(p.identityId!) ?? [];
    list.push(p.id);
    byIdentity.set(p.identityId!, list);
  }
  const identityIds = [...byIdentity.keys()];
  if (identityIds.length) {
    const rels = await db.identityRelationship.findMany({
      where: { kind: "MARRIAGE", status: "CONFIRMED", aIdentityId: { in: identityIds }, bIdentityId: { in: identityIds } },
      select: { aIdentityId: true, bIdentityId: true },
    });
    for (const r of rels) {
      for (const ap of byIdentity.get(r.aIdentityId) ?? []) {
        for (const bp of byIdentity.get(r.bIdentityId) ?? []) {
          if (ap === bp) continue;
          if (!(combined.spouses[ap] ?? []).includes(bp)) (combined.spouses[ap] ??= []).push(bp);
          if (!(combined.spouses[bp] ?? []).includes(ap)) (combined.spouses[bp] ??= []).push(ap);
        }
      }
    }
  }

  const treeIds = [...included];
  const trees = await db.tree.findMany({ where: { id: { in: treeIds } }, select: { id: true, name: true } });
  const treeNames = Object.fromEntries(trees.map((t) => [t.id, t.name]));

  return { graph: combined, treeIds, personTree, treeNames };
}

async function sanitizeForeignGraph(treeId: string, g: TreeGraph): Promise<TreeGraph> {
  const rows = await db.person.findMany({ where: { treeId }, select: { id: true, privacy: true } });
  const privacy = new Map(rows.map((r) => [r.id, r.privacy]));

  const drop = new Set(Object.keys(g.persons).filter((id) => privacy.get(id) === "PRIVATE"));
  if (drop.size === 0) {
    for (const [id, p] of Object.entries(g.persons)) {
      if (privacy.get(id) === "REDACTED") {
        g.persons[id] = { ...p, name: "a family member", given: "", surname: "" };
      }
    }
    return g;
  }

  const persons: TreeGraph["persons"] = {};
  for (const [id, p] of Object.entries(g.persons)) {
    if (drop.has(id)) continue;
    persons[id] = privacy.get(id) === "REDACTED" ? { ...p, name: "a family member", given: "", surname: "" } : p;
  }
  const strip = (map: Record<string, string[]>) => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(map)) {
      if (drop.has(k)) continue;
      const filtered = v.filter((id) => !drop.has(id));
      if (filtered.length) out[k] = filtered;
    }
    return out;
  };
  return { persons, up: strip(g.up), down: strip(g.down), spouses: strip(g.spouses), total: g.total, truncated: g.truncated };
}
