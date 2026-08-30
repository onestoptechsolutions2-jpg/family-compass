import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import type { TreeGraph, GraphPerson } from "@/lib/queries/graph";
import { getTreeGraph } from "@/lib/queries/graph";
import { presumedLiving } from "@/lib/person";

// ---- share password (low-stakes: salted sha256) ----------------------------

export function hashSharePassword(pw: string): string {
  const salt = randomBytes(9).toString("hex");
  return `${salt}:${createHash("sha256").update(`${salt}:${pw}`).digest("hex")}`;
}

export function verifySharePassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return createHash("sha256").update(`${salt}:${pw}`).digest("hex") === hash;
}

/** Deterministic cookie token proving the visitor cleared the password gate. */
export function shareCookieToken(stored: string): string {
  return createHash("sha256").update(`gate:${stored}`).digest("hex").slice(0, 32);
}

// ---- redacted graph for a public shared view -------------------------------

type ShareOptions = {
  centralPersonId: string;
  generations: number;
  includeLiving: boolean;
};

const REDACTED: Partial<GraphPerson> = {
  birth: "",
  death: "",
  birthYear: null,
  deathYear: null,
};

/**
 * Whole-tree graph with PRIVATE people removed and living people reduced to
 * "Living <surname>" unless the share opts in to showing them.
 */
export async function getRedactedGraph(
  treeId: string,
  opts: ShareOptions,
): Promise<TreeGraph & { centralPersonId: string }> {
  const full = await getTreeGraph(treeId, opts.centralPersonId);

  const privacyRows = await db.person.findMany({
    where: { treeId },
    select: { id: true, privacy: true },
  });
  const privacy = new Map(privacyRows.map((r) => [r.id, r.privacy]));

  const persons: Record<string, GraphPerson> = {};
  for (const [id, p] of Object.entries(full.persons)) {
    const vis = privacy.get(id);
    if (vis === "PRIVATE") continue;
    const living = presumedLiving({
      explicitLiving: p.living,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
      hasDeathEvent: p.deathYear != null,
    });
    if (vis === "REDACTED") {
      // stays in the tree as a named node, but nothing else is shown
      persons[id] = { ...p, ...REDACTED };
    } else if (living && !opts.includeLiving) {
      persons[id] = {
        ...p,
        ...REDACTED,
        name: p.surname ? `Living ${p.surname}` : "Living person",
        given: "",
      };
    } else {
      persons[id] = p;
    }
  }

  const prune = (map: Record<string, string[]>) => {
    const out: Record<string, string[]> = {};
    for (const [k, vs] of Object.entries(map)) {
      if (!persons[k]) continue;
      const kept = vs.filter((v) => persons[v]);
      if (kept.length) out[k] = kept;
    }
    return out;
  };

  return {
    persons,
    up: prune(full.up),
    down: prune(full.down),
    spouses: prune(full.spouses),
    total: Object.keys(persons).length,
    truncated: full.truncated,
    centralPersonId: opts.centralPersonId,
  };
}
