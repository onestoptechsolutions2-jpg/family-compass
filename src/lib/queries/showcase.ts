import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";

export type ShowcaseTree = {
  id: string;
  name: string;
  region: string | null;
  community: string | null;
  people: number;
  families: number;
  clans: number;
};

export type PublicShowcase = {
  top: ShowcaseTree[];
  totals: { trees: number; people: number } | null;
};

export const SHOWCASE_TAG = "public-showcase";

async function computeShowcase(): Promise<PublicShowcase> {
  const trees = await db.tree.findMany({
    where: { discoverable: true, showcase: true },
    select: {
      id: true,
      name: true,
      region: true,
      community: true,
      _count: { select: { people: true, families: true } },
    },
  });

  const ranked = trees
    .filter((t) => t._count.people >= 15)
    .sort((a, b) => b._count.people - a._count.people)
    .slice(0, 5);

  if (ranked.length === 0) return { top: [], totals: null };

  const clanRows = await db.person.groupBy({
    by: ["treeId", "clanId"],
    where: { treeId: { in: ranked.map((t) => t.id) }, clanId: { not: null } },
  });
  const clansByTree = new Map<string, number>();
  for (const r of clanRows) clansByTree.set(r.treeId, (clansByTree.get(r.treeId) ?? 0) + 1);

  const [treeCount, peopleCount] = await Promise.all([db.tree.count(), db.person.count()]);

  return {
    top: ranked.map((t) => ({
      id: t.id,
      name: t.name,
      region: t.region,
      community: t.community,
      people: t._count.people,
      families: t._count.families,
      clans: clansByTree.get(t.id) ?? 0,
    })),
    totals: treeCount >= 3 ? { trees: treeCount, people: peopleCount } : null,
  };
}

/**
 * Public "proof of use" for the landing page. Directory-opted-in trees only
 * (`discoverable` + `showcase`), aggregate counts only. Cached for 10 minutes
 * and on the `public-showcase` tag (revalidated when a tree's discovery
 * settings change) so the landing page isn't 3 queries per hit.
 */
export const publicShowcase = unstable_cache(computeShowcase, ["public-showcase"], {
  revalidate: 600,
  tags: [SHOWCASE_TAG],
});
