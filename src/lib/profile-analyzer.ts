import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";

/**
 * Looks at one profile and works out what's missing, aiming at a complete
 * record for **four generations** (self → parents → grandparents →
 * great-grandparents). Returns a to-do list of concrete questions, each
 * deep-linking to where it gets answered.
 */

export type Gap = {
  id: string;
  kind: "core" | "ancestry";
  /** the question to put to the profile owner */
  question: string;
  /** where it gets answered */
  href: string;
  cta: string;
};

const GEN_TARGET = [2, 4, 8]; // parents, grandparents, great-grandparents
const GEN_LABEL = ["Parents", "Grandparents", "Great-grandparents"];
const ANCESTOR_TARGET = GEN_TARGET.reduce((a, b) => a + b, 0); // 14

type Anc = { id: string; name: string; hasParents: boolean };

async function ancestorGenerations(
  treeId: string,
  rootId: string,
): Promise<{ gens: Anc[][]; rootHasParents: boolean }> {
  const gens: Anc[][] = [];
  let frontier = [rootId];
  let rootHasParents = false;

  for (let g = 0; g < GEN_TARGET.length && frontier.length > 0; g++) {
    const rows = await db.childRef.findMany({
      where: { personId: { in: frontier }, family: { treeId } },
      select: {
        personId: true,
        family: {
          select: {
            partner1: { select: { id: true, names: { select: NAME_SELECT } } },
            partner2: { select: { id: true, names: { select: NAME_SELECT } } },
          },
        },
      },
    });

    const gotParent = new Set(
      rows.filter((r) => r.family.partner1 || r.family.partner2).map((r) => r.personId),
    );
    if (g === 0) rootHasParents = gotParent.has(rootId);
    else for (const a of gens[g - 1]!) a.hasParents = gotParent.has(a.id);

    const seen = new Set<string>();
    const parents: Anc[] = [];
    for (const r of rows) {
      for (const p of [r.family.partner1, r.family.partner2]) {
        if (p && !seen.has(p.id)) {
          seen.add(p.id);
          parents.push({ id: p.id, name: displayName(p.names), hasParents: false });
        }
      }
    }
    gens.push(parents);
    frontier = parents.map((p) => p.id);
  }

  return { gens, rootHasParents };
}

export type ProfileAnalysis = {
  ancestry: {
    present: number;
    target: number;
    score: number; // 0–100
    byGen: { label: string; present: number; target: number }[];
  };
  gaps: Gap[];
  self: boolean; // is the viewer the profile owner
};

export async function analyzeProfile(
  treeId: string,
  personId: string,
  viewerUserId: string | null,
): Promise<ProfileAnalysis> {
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      claimedByUserId: true,
      clanId: true,
      _count: { select: { mediaRefs: true } },
      eventRefs: {
        where: { event: { type: { in: ["Birth", "Death", "Burial"] } } },
        select: { event: { select: { type: true, dateYear: true, placeId: true } } },
      },
    },
  });
  if (!person) {
    return {
      ancestry: { present: 0, target: ANCESTOR_TARGET, score: 0, byGen: [] },
      gaps: [],
      self: false,
    };
  }

  const self = !!viewerUserId && person.claimedByUserId === viewerUserId;
  const you = self ? "your" : "their";
  const base = `/trees/${treeId}/people/${personId}`;
  const deceased = person.eventRefs.some((e) => e.event.type === "Death" || e.event.type === "Burial");
  const birth = person.eventRefs.find((e) => e.event.type === "Birth")?.event ?? null;

  const { gens, rootHasParents } = await ancestorGenerations(treeId, personId);

  const byGen = GEN_TARGET.map((target, i) => ({
    label: GEN_LABEL[i]!,
    present: gens[i]?.length ?? 0,
    target,
  }));
  const present = byGen.reduce((a, g) => a + Math.min(g.present, g.target), 0);
  const ancestryScore = Math.round((present / ANCESTOR_TARGET) * 100);

  const gaps: Gap[] = [];

  // --- core (about this person) ---
  if (!birth?.dateYear) {
    gaps.push({
      id: "birth-year",
      kind: "core",
      question: `When ${self ? "were you" : "was this person"} born?`,
      href: `${base}/edit`,
      cta: "Add year",
    });
  }
  if (!birth?.placeId) {
    gaps.push({
      id: "birth-place",
      kind: "core",
      question: `Where ${self ? "were you" : "was this person"} born? Which village and county?`,
      href: `${base}/edit`,
      cta: "Add place",
    });
  }
  if (person._count.mediaRefs === 0 && !deceased) {
    gaps.push({
      id: "photo",
      kind: "core",
      question: `Add a photo of ${self ? "yourself" : "this person"}.`,
      href: `${base}#tab=photos`,
      cta: "Add photo",
    });
  }
  if (!person.clanId) {
    gaps.push({
      id: "clan",
      kind: "core",
      question: `Which clan and sub-clan ${self ? "are you" : "is this person"} from?`,
      href: `${base}/edit`,
      cta: "Set clan",
    });
  }

  // --- ancestry: fill generation by generation ---
  if (!rootHasParents) {
    gaps.push({
      id: "parents",
      kind: "ancestry",
      question: `Who were ${you} parents — ${self ? "your" : "their"} mother and father? Add them.`,
      href: `${base}#tab=family`,
      cta: "Add parents",
    });
  } else if ((gens[0]?.length ?? 0) < 2) {
    gaps.push({
      id: "parent-2",
      kind: "ancestry",
      question: `Only one parent is recorded. Add the other.`,
      href: `${base}#tab=family`,
      cta: "Add parent",
    });
  }

  for (let g = 0; g < gens.length && g < GEN_TARGET.length - 1; g++) {
    for (const anc of gens[g] ?? []) {
      if (!anc.hasParents) {
        gaps.push({
          id: `anc-${anc.id}`,
          kind: "ancestry",
          question: `Who were ${anc.name}'s parents? (${GEN_LABEL[g + 1]!.toLowerCase()} of ${self ? "yours" : "this person"})`,
          href: `/trees/${treeId}/people/${anc.id}#tab=family`,
          cta: "Add parents",
        });
      }
    }
  }

  return {
    ancestry: { present, target: ANCESTOR_TARGET, score: ancestryScore, byGen },
    gaps,
    self,
  };
}
