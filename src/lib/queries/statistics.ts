import { db } from "@/lib/db";
import { displayName, presumedLiving } from "@/lib/person";

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

export type TreeStatistics = Awaited<ReturnType<typeof getTreeStatistics>>;

function decadeOf(year: number | null | undefined): string | null {
  if (!year || year < 1500 || year > 2200) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

export async function getTreeStatistics(treeId: string) {
  const [people, families, eventCount, sourceCount, placeCount, clans] = await Promise.all([
    db.person.findMany({
      where: { treeId },
      select: {
        id: true,
        gender: true,
        living: true,
        clanId: true,
        names: { select: NAME_SELECT },
        _count: { select: { mediaRefs: true } },
        eventRefs: {
          where: { event: { type: { in: ["Birth", "Death"] } } },
          select: { event: { select: { type: true, dateYear: true } } },
        },
      },
    }),
    db.family.findMany({
      where: { treeId },
      select: {
        id: true,
        partner1: { select: { names: { select: NAME_SELECT } } },
        partner2: { select: { names: { select: NAME_SELECT } } },
        _count: { select: { childRefs: true } },
      },
    }),
    db.event.count({ where: { treeId } }),
    db.source.count({ where: { treeId } }),
    db.place.count({ where: { treeId } }),
    db.clan.findMany({ where: { treeId }, select: { id: true, name: true } }),
  ]);

  const total = people.length;
  const sex = { MALE: 0, FEMALE: 0, UNKNOWN: 0 } as Record<string, number>;
  const birthsByDecade = new Map<string, number>();
  const deathsByDecade = new Map<string, number>();
  const surnames = new Map<string, number>();
  const clanName = new Map(clans.map((c) => [c.id, c.name]));
  const clanCounts = new Map<string, number>();
  const lifespans: number[] = [];
  let deceased = 0;
  let withPhoto = 0;
  let oldestLiving: { name: string; year: number } | null = null;
  let youngestLiving: { name: string; year: number } | null = null;

  for (const p of people) {
    sex[p.gender] = (sex[p.gender] ?? 0) + 1;
    if (p._count.mediaRefs > 0) withPhoto++;

    const birthYear = p.eventRefs.find((e) => e.event.type === "Birth")?.event.dateYear ?? null;
    const deathYear = p.eventRefs.find((e) => e.event.type === "Death")?.event.dateYear ?? null;
    const living = presumedLiving({
      explicitLiving: p.living,
      birthYear,
      deathYear,
      hasDeathEvent: deathYear != null,
    });
    if (!living) deceased++;

    const bd = decadeOf(birthYear);
    if (bd) birthsByDecade.set(bd, (birthsByDecade.get(bd) ?? 0) + 1);
    const dd = decadeOf(deathYear);
    if (dd) deathsByDecade.set(dd, (deathsByDecade.get(dd) ?? 0) + 1);

    if (birthYear && deathYear && deathYear >= birthYear && deathYear - birthYear <= 120) {
      lifespans.push(deathYear - birthYear);
    }

    const preferred = p.names.find((n) => n.preferred) ?? p.names[0];
    const sn = [preferred?.surnamePrefix, preferred?.surname].filter(Boolean).join(" ").trim();
    if (sn) surnames.set(sn, (surnames.get(sn) ?? 0) + 1);

    if (p.clanId) {
      const label = clanName.get(p.clanId) ?? "Unknown clan";
      clanCounts.set(label, (clanCounts.get(label) ?? 0) + 1);
    }

    if (living && birthYear) {
      const name = displayName(p.names);
      if (!oldestLiving || birthYear < oldestLiving.year) oldestLiving = { name, year: birthYear };
      if (!youngestLiving || birthYear > youngestLiving.year) youngestLiving = { name, year: birthYear };
    }
  }

  const sortDesc = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));
  const sortDecades = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }));

  const largestFamilies = families
    .filter((f) => f._count.childRefs > 0)
    .sort((a, b) => b._count.childRefs - a._count.childRefs)
    .slice(0, 5)
    .map((f) => ({
      id: f.id,
      children: f._count.childRefs,
      partners: [f.partner1, f.partner2]
        .filter(Boolean)
        .map((p) => displayName(p!.names))
        .join(" & ") || "Unknown couple",
    }));

  const avgLifespan = lifespans.length
    ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
    : null;
  const avgChildren = families.length
    ? Math.round((families.reduce((a, f) => a + f._count.childRefs, 0) / families.length) * 10) / 10
    : 0;

  return {
    totals: {
      people: total,
      families: families.length,
      events: eventCount,
      sources: sourceCount,
      places: placeCount,
      living: total - deceased,
      deceased,
    },
    sex: { male: sex.MALE ?? 0, female: sex.FEMALE ?? 0, unknown: sex.UNKNOWN ?? 0 },
    coverage: {
      withPhoto,
      withPhotoPct: total ? Math.round((withPhoto / total) * 100) : 0,
      lifespanSample: lifespans.length,
    },
    avgLifespan,
    avgChildren,
    birthsByDecade: sortDecades(birthsByDecade),
    deathsByDecade: sortDecades(deathsByDecade),
    topSurnames: sortDesc(surnames, 10),
    topClans: sortDesc(clanCounts, 10),
    largestFamilies,
    oldestLiving: oldestLiving as { name: string; year: number } | null,
    youngestLiving: youngestLiving as { name: string; year: number } | null,
  };
}
