import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";

export type ConnectionHop = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  /** how this hop is described, e.g. "friend", "mentor", "chosen-sibling" */
  relation: string;
  /** set when the hop crosses into another family's tree */
  otherFamily: string | null;
};

export type ConnectionResult = {
  found: boolean;
  hops: ConnectionHop[];
};

type Neighbour = { id: string; name: string; relation: string; otherFamily: string | null };

/**
 * Shortest path between two people through the *chosen* graph — RelationEdge
 * (within a tree) plus FriendLink (across trees). Not bloodline: that's
 * "Are we related?". Returns { found:false } when there's no social path
 * within `maxHops`.
 */
export async function howConnected(
  aPersonId: string,
  bPersonId: string,
  maxHops = 6,
): Promise<ConnectionResult> {
  if (aPersonId === bPersonId) return { found: true, hops: [] };

  const nameCache = new Map<string, string>();
  const nameOf = async (ids: string[]) => {
    const missing = ids.filter((id) => !nameCache.has(id));
    if (missing.length) {
      const rows = await db.person.findMany({
        where: { id: { in: missing } },
        select: { id: true, names: { select: NAME_SELECT } },
      });
      for (const r of rows) nameCache.set(r.id, displayName(r.names));
      for (const id of missing) if (!nameCache.has(id)) nameCache.set(id, "Someone");
    }
    return ids;
  };

  const neighboursOf = async (ids: string[]): Promise<Map<string, Neighbour[]>> => {
    const [edges, links] = await Promise.all([
      db.relationEdge.findMany({
        where: { OR: [{ aPersonId: { in: ids } }, { bPersonId: { in: ids } }] },
        select: { aPersonId: true, bPersonId: true, roles: true },
      }),
      db.friendLink.findMany({
        where: { OR: [{ aPersonId: { in: ids } }, { bPersonId: { in: ids } }] },
        select: {
          aPersonId: true, bPersonId: true, roles: true,
          aPerson: { select: { tree: { select: { name: true } } } },
          bPerson: { select: { tree: { select: { name: true } } } },
        },
      }),
    ]);

    const idset = new Set(ids);
    const out = new Map<string, Neighbour[]>();
    const add = (from: string, n: Neighbour) => {
      const list = out.get(from) ?? [];
      list.push(n);
      out.set(from, list);
    };

    for (const e of edges) {
      const rel = e.roles[0] ?? "connected";
      if (idset.has(e.aPersonId)) add(e.aPersonId, { id: e.bPersonId, name: "", relation: rel, otherFamily: null });
      if (idset.has(e.bPersonId)) add(e.bPersonId, { id: e.aPersonId, name: "", relation: rel, otherFamily: null });
    }
    for (const l of links) {
      const rel = l.roles[0] ?? "friend";
      if (idset.has(l.aPersonId))
        add(l.aPersonId, { id: l.bPersonId, name: "", relation: rel, otherFamily: l.bPerson.tree.name });
      if (idset.has(l.bPersonId))
        add(l.bPersonId, { id: l.aPersonId, name: "", relation: rel, otherFamily: l.aPerson.tree.name });
    }
    return out;
  };

  // BFS with parent pointers
  const parent = new Map<string, { via: string; relation: string; otherFamily: string | null }>();
  const seen = new Set<string>([aPersonId]);
  let frontier = [aPersonId];

  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const nbrs = await neighboursOf(frontier);
    const next: string[] = [];
    for (const [from, list] of nbrs) {
      for (const n of list) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        parent.set(n.id, { via: from, relation: n.relation, otherFamily: n.otherFamily });
        if (n.id === bPersonId) {
          // reconstruct
          const chain: string[] = [bPersonId];
          let cur = bPersonId;
          while (cur !== aPersonId) {
            cur = parent.get(cur)!.via;
            chain.push(cur);
          }
          chain.reverse();
          await nameOf(chain);
          const hops: ConnectionHop[] = [];
          for (let i = 0; i < chain.length - 1; i++) {
            const meta = parent.get(chain[i + 1]!)!;
            hops.push({
              fromId: chain[i]!,
              fromName: nameCache.get(chain[i]!) ?? "Someone",
              toId: chain[i + 1]!,
              toName: nameCache.get(chain[i + 1]!) ?? "Someone",
              relation: meta.relation,
              otherFamily: meta.otherFamily,
            });
          }
          return { found: true, hops };
        }
        next.push(n.id);
      }
    }
    frontier = next;
  }

  return { found: false, hops: [] };
}
