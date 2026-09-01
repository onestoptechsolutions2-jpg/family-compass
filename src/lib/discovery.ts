import { db } from "@/lib/db";
import { displayName, primaryName, NAME_SELECT, presumedLiving } from "@/lib/person";
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
  givenName: string | null;
  surnameInitial: string | null;
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
    const pn = primaryName(p.names);
    return {
      personId: p.id,
      name: displayName(p.names),
      givenName: pn?.first?.trim() || null,
      surnameInitial: pn?.surname?.trim()?.[0]?.toUpperCase() || null,
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

export type TeaserRow = {
  /** first name + surname initial, e.g. "Joash O." — never the full surname */
  label: string;
  clan: string | null;
  bornDecade: string | null;
  place: string | null;
  living: boolean;
};

/**
 * The free preview shows each match as a teaser — enough to recognise a
 * possible relative (given name, clan, rough era, area) but not enough to
 * contact them or place them in a tree. Paying unlocks the full record and the
 * family's WhatsApp. Capped so the list entices rather than satisfies.
 */
export function teaserRows(candidates: Candidate[], limit = 8): TeaserRow[] {
  return candidates.slice(0, limit).map((c) => ({
    label: [c.givenName ?? "—", c.surnameInitial ? `${c.surnameInitial}.` : null]
      .filter(Boolean)
      .join(" "),
    clan: c.clan,
    bornDecade: c.birthYear ? `${Math.floor(c.birthYear / 10) * 10}s` : null,
    place: c.community ?? c.region,
    living: c.living,
  }));
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
