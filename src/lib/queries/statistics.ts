import { db } from "@/lib/db";
import { displayName, genderSymbol, NAME_SELECT, presumedLiving } from "@/lib/person";

export type TreeStatistics = Awaited<ReturnType<typeof getTreeStatistics>>;

function decadeOf(year: number | null | undefined): string | null {
  if (!year || year < 1500 || year > 2200) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

export type EnergyPart = { key: string; label: string; pct: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * "Energy" per household: how living & complete each Family's record is,
 * scored from the same signals as the tree-wide bar but over just that
 * family's members (both partners + every child), plus how many of the
 * chosen/kin bonds among them are recorded.
 */
export async function familyEnergyReport(treeId: string) {
  const families = await db.family.findMany({
    where: { treeId },
    select: {
      id: true,
      partner1: { select: { id: true, names: { select: NAME_SELECT } } },
      partner2: { select: { id: true, names: { select: NAME_SELECT } } },
      childRefs: { select: { person: { select: { id: true, names: { select: NAME_SELECT } } } } },
      _count: { select: { eventRefs: true } },
    },
  });
  if (families.length === 0) return [];

  const memberIds = new Set<string>();
  for (const f of families) {
    if (f.partner1) memberIds.add(f.partner1.id);
    if (f.partner2) memberIds.add(f.partner2.id);
    for (const c of f.childRefs) memberIds.add(c.person.id);
  }

  const [people, edges] = await Promise.all([
    db.person.findMany({
      where: { id: { in: [...memberIds] } },
      select: {
        id: true,
        _count: { select: { mediaRefs: true, eventRefs: true, memoryParticipations: true } },
        eventRefs: { where: { event: { type: "Birth" } }, select: { id: true }, take: 1 },
      },
    }),
    db.relationEdge.findMany({ where: { treeId }, select: { aPersonId: true, bPersonId: true } }),
  ]);

  const byId = new Map(people.map((p) => [p.id, p]));
  const personEnergy = (id: string): number => {
    const p = byId.get(id);
    if (!p) return 0;
    const dated = p.eventRefs.length > 0 ? 1 : 0;
    const photos = clamp01(p._count.mediaRefs / 2);
    const events = clamp01(p._count.eventRefs / 2);
    const stories = clamp01(p._count.memoryParticipations / 2);
    return (dated + photos + events + stories) / 4;
  };

  const edgeSet = new Set(edges.map((e) => `${e.aPersonId}|${e.bPersonId}`));
  const bondsAmong = (ids: string[]): number => {
    if (ids.length < 2) return 0;
    let hit = 0;
    let pairs = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs++;
        const [a, b] = ids[i]! < ids[j]! ? [ids[i]!, ids[j]!] : [ids[j]!, ids[i]!];
        if (edgeSet.has(`${a}|${b}`)) hit++;
      }
    }
    return pairs ? hit / pairs : 0;
  };

  const rows = families.map((f) => {
    const members = [
      f.partner1?.id,
      f.partner2?.id,
      ...f.childRefs.map((c) => c.person.id),
    ].filter((x): x is string => !!x);

    const memberAvg = members.length
      ? members.reduce((a, id) => a + personEnergy(id), 0) / members.length
      : 0;
    const bonds = bondsAmong(members);
    const score = Math.round((memberAvg * 0.8 + bonds * 0.2) * 100);

    const partners = [f.partner1, f.partner2]
      .filter(Boolean)
      .map((p) => displayName(p!.names))
      .join(" & ");

    return {
      id: f.id,
      label: partners || "Unknown couple",
      size: members.length,
      score,
      parts: [
        { key: "member", label: "Records", pct: Math.round(memberAvg * 100) },
        { key: "bonds", label: "Bonds", pct: Math.round(bonds * 100) },
      ] as EnergyPart[],
    };
  });

  return rows.sort((a, b) => b.score - a.score || b.size - a.size);
}

export async function getTreeStatistics(treeId: string) {
  const [people, families, eventCount, sourceCount, placeCount, clans, memoryCount, edgeCount] =
    await Promise.all([
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
    db.memory.count({ where: { treeId } }),
    db.relationEdge.count({ where: { treeId } }),
  ]);

  const connectedPeople = await db.person.count({
    where: {
      treeId,
      OR: [
        { familiesAsPartner1: { some: {} } },
        { familiesAsPartner2: { some: {} } },
        { childRefs: { some: {} } },
      ],
    },
  });

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
  let withBirthYear = 0;
  let oldestLiving: { name: string; year: number } | null = null;
  let youngestLiving: { name: string; year: number } | null = null;

  for (const p of people) {
    sex[p.gender] = (sex[p.gender] ?? 0) + 1;
    if (p._count.mediaRefs > 0) withPhoto++;

    const birthYear = p.eventRefs.find((e) => e.event.type === "Birth")?.event.dateYear ?? null;
    const deathYear = p.eventRefs.find((e) => e.event.type === "Death")?.event.dateYear ?? null;
    if (birthYear) withBirthYear++;
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

  // ---- "Family energy": how living & complete the record is (0–100) --------
  const per = (n: number) => (total ? n / total : 0);
  const energyParts = [
    { key: "connected", label: "Connected", weight: 1.1, v: clamp01(per(connectedPeople)) },
    { key: "dated", label: "Dated lives", weight: 1, v: clamp01(per(withBirthYear)) },
    { key: "photos", label: "Photos", weight: 1, v: clamp01(per(withPhoto)) },
    { key: "events", label: "Events", weight: 0.9, v: clamp01(per(eventCount) / 2) },
    { key: "stories", label: "Memories", weight: 1.2, v: clamp01(per(memoryCount)) },
    { key: "bonds", label: "Bonds", weight: 0.8, v: clamp01(per(edgeCount) / 1.5) },
  ];
  const wsum = energyParts.reduce((a, p) => a + p.weight, 0);
  const energyScore = total
    ? Math.round((energyParts.reduce((a, p) => a + p.weight * p.v, 0) / wsum) * 100)
    : 0;
  const energy = {
    score: energyScore,
    parts: energyParts.map((p) => ({ key: p.key, label: p.label, pct: Math.round(p.v * 100) })),
  };

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
    energy,
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

// ---------------------------------------------------------------------------
// Report drill-downs
// ---------------------------------------------------------------------------

export type DrillPerson = { id: string; name: string; gender: string; symbol: string; years: string; deceased: boolean };
export type Drilldown = { title: string; people: DrillPerson[] } | null;

/**
 * Resolve a drill-down key into a people list.
 * Keys: born:1980s | died:1980s | surname:<name> | clan:<clanId> |
 *       living | deceased | nophoto | sex:MALE|FEMALE|UNKNOWN
 */
export async function getReportDrilldown(treeId: string, key: string): Promise<Drilldown> {
  const [kind, ...rest] = key.split(":");
  const arg = rest.join(":");

  const base = {
    treeId,
    ...(kind === "clan" ? { clanId: arg } : {}),
    ...(kind === "sex" ? { gender: arg as "MALE" | "FEMALE" | "UNKNOWN" | "OTHER" } : {}),
    ...(kind === "nophoto" ? { mediaRefs: { none: {} } } : {}),
  };

  const rows = await db.person.findMany({
    where: base,
    take: 500,
    select: {
      id: true,
      gender: true,
      living: true,
      names: { select: NAME_SELECT },
      eventRefs: {
        where: { event: { type: { in: ["Birth", "Death", "Burial"] } } },
        select: { event: { select: { type: true, dateYear: true, dateMonth: true, dateDay: true, dateText: true, dateModifier: true, dateQuality: true } } },
      },
    },
  });

  const decade = (y: number | null | undefined) => (y && y >= 1500 && y <= 2200 ? `${Math.floor(y / 10) * 10}s` : null);

  const mapped = rows
    .map((p) => {
      const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event ?? null;
      const death = p.eventRefs.find((r) => r.event.type === "Death")?.event ?? null;
      const deceased = p.eventRefs.some((r) => r.event.type === "Death" || r.event.type === "Burial");
      const by = birth?.dateYear ?? null;
      const dy = death?.dateYear ?? null;
      const living = presumedLiving({ explicitLiving: p.living, birthYear: by, deathYear: dy, hasDeathEvent: !!death });
      const preferred = p.names.find((n) => n.preferred) ?? p.names[0];
      const surname = [preferred?.surnamePrefix, preferred?.surname].filter(Boolean).join(" ").trim();
      return {
        id: p.id,
        name: displayName(p.names),
        gender: p.gender,
        symbol: genderSymbol(p.gender),
        years: by || dy ? `${by ?? "?"} – ${dy ?? (living ? "" : "?")}` : "",
        _birthDecade: decade(by),
        _deathDecade: decade(dy),
        _surname: surname,
        _living: living,
        _deceased: deceased,
      };
    })
    .filter((p) => {
      if (kind === "born") return p._birthDecade === arg;
      if (kind === "died") return p._deathDecade === arg;
      if (kind === "surname") return p._surname.toLowerCase() === arg.toLowerCase();
      if (kind === "living") return p._living;
      if (kind === "deceased") return p._deceased;
      return true; // clan / sex / nophoto handled by the where clause
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const titles: Record<string, string> = {
    born: `Born in the ${arg}`,
    died: `Died in the ${arg}`,
    surname: `Surname “${arg}”`,
    clan: "Clan members",
    living: "Living people",
    deceased: "Deceased people",
    nophoto: "People without a photo",
    sex: `${arg[0]}${arg.slice(1).toLowerCase()}`,
  };

  return {
    title: titles[kind ?? ""] ?? "People",
    people: mapped.map(({ _birthDecade, _deathDecade, _surname, _living, _deceased, ...r }) => {
      void _birthDecade; void _deathDecade; void _surname; void _living;
      return { ...r, deceased: _deceased };
    }),
  };
}
