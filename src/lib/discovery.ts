import { db } from "@/lib/db";
import { displayName, presumedLiving } from "@/lib/person";
import { normalizeClan } from "@/lib/clan";

export type DirectoryQuery = {
  name?: string;
  clan?: string;
  community?: string;
  region?: string;
  birthYear?: number;
  window?: number;
};

export type Candidate = {
  personId: string;
  name: string;
  clan: string | null;
  community: string | null;
  region: string | null;
  birthYear: number | null;
  deathYear: number | null;
  living: boolean;
  treeId: string;
  treeName: string;
  ownerWhatsapp: string | null;
};

const NAME_SELECT = {
  first: true,
  surname: true,
  surnamePrefix: true,
  suffix: true,
  nick: true,
  title: true,
  preferred: true,
  type: true,
  order: true,
} as const;

/** Search PRIVATE-excluded people across trees that opted into the directory. */
export async function searchDirectory(q: DirectoryQuery): Promise<Candidate[]> {
  const name = q.name?.trim();
  const clanN = q.clan ? normalizeClan(q.clan) : "";
  const win = q.window ?? 5;

  const people = await db.person.findMany({
    where: {
      privacy: { not: "PRIVATE" },
      tree: {
        discoverable: true,
        ...(q.community ? { community: { contains: q.community, mode: "insensitive" } } : {}),
        ...(q.region ? { region: { contains: q.region, mode: "insensitive" } } : {}),
      },
      ...(name
        ? {
            names: {
              some: {
                OR: [
                  { first: { contains: name, mode: "insensitive" } },
                  { surname: { contains: name, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
      ...(clanN ? { clan: { normalized: { contains: clanN } } } : {}),
    },
    select: {
      id: true,
      living: true,
      names: { select: NAME_SELECT },
      clan: { select: { name: true } },
      eventRefs: {
        where: { event: { type: { in: ["Birth", "Death"] } } },
        select: { event: { select: { type: true, dateYear: true } } },
      },
      tree: {
        select: { id: true, name: true, community: true, region: true, contactWhatsapp: true },
      },
    },
    take: 400,
  });

  const rows: Candidate[] = people.map((p) => {
    const birthYear = p.eventRefs.find((e) => e.event.type === "Birth")?.event.dateYear ?? null;
    const deathYear = p.eventRefs.find((e) => e.event.type === "Death")?.event.dateYear ?? null;
    return {
      personId: p.id,
      name: displayName(p.names),
      clan: p.clan?.name ?? null,
      community: p.tree.community,
      region: p.tree.region,
      birthYear,
      deathYear,
      living: presumedLiving({ explicitLiving: p.living, birthYear, deathYear, hasDeathEvent: deathYear != null }),
      treeId: p.tree.id,
      treeName: p.tree.name,
      ownerWhatsapp: p.tree.contactWhatsapp,
    };
  });

  const filtered = q.birthYear
    ? rows.filter((r) => r.birthYear == null || Math.abs(r.birthYear - q.birthYear!) <= win)
    : rows;

  filtered.sort((a, b) => {
    // prefer rows with a birth year near the target, then name
    const ay = q.birthYear && a.birthYear ? Math.abs(a.birthYear - q.birthYear) : 999;
    const by = q.birthYear && b.birthYear ? Math.abs(b.birthYear - q.birthYear) : 999;
    return ay - by || a.name.localeCompare(b.name);
  });

  return filtered.slice(0, 60);
}

/** Coarse, non-identifying summary for the free preview. */
export function previewSummary(candidates: Candidate[]) {
  const clans = [...new Set(candidates.map((c) => c.clan).filter(Boolean))] as string[];
  const communities = [...new Set(candidates.map((c) => c.community).filter(Boolean))] as string[];
  const regions = [...new Set(candidates.map((c) => c.region).filter(Boolean))] as string[];
  const decades = [
    ...new Set(candidates.map((c) => (c.birthYear ? `${Math.floor(c.birthYear / 10) * 10}s` : null)).filter(Boolean)),
  ] as string[];
  return { count: candidates.length, clans, communities, regions, decades };
}
