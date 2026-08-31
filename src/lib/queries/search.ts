import { db } from "@/lib/db";
import { displayName } from "@/lib/person";

const NAME_SELECT = {
  first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true,
  preferred: true, type: true, order: true,
} as const;

export type SearchHit = { type: string; id: string; label: string; sub?: string; href: string; icon: string };

/** Universal search within one tree. */
export async function searchTree(treeId: string, qRaw: string): Promise<SearchHit[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const like = { contains: q, mode: "insensitive" as const };

  const [people, places, clans, families, memorials] = await Promise.all([
    db.person.findMany({
      where: { treeId, names: { some: { OR: [{ first: like }, { surname: like }, { nick: like }] } } },
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
      take: 12,
    }),
    db.place.findMany({ where: { treeId, title: like }, select: { id: true, title: true }, take: 6 }),
    db.clan.findMany({ where: { treeId, name: like }, select: { id: true, name: true, community: true }, take: 6 }),
    db.family.findMany({
      where: {
        treeId,
        OR: [
          { partner1: { names: { some: { surname: like } } } },
          { partner2: { names: { some: { surname: like } } } },
        ],
      },
      select: {
        id: true,
        partner1: { select: { names: { select: NAME_SELECT } } },
        partner2: { select: { names: { select: NAME_SELECT } } },
      },
      take: 6,
    }),
    db.memorial.findMany({
      where: {
        treeId,
        OR: [{ headline: like }, { person: { names: { some: { OR: [{ first: like }, { surname: like }] } } } }],
      },
      select: { slug: true, headline: true, published: true, person: { select: { names: { select: NAME_SELECT } } } },
      take: 6,
    }),
  ]);

  const base = `/trees/${treeId}`;
  const hits: SearchHit[] = [];

  for (const p of people) {
    const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event ?? null;
    const death = p.eventRefs.find((r) => r.event.type === "Death" || r.event.type === "Burial")?.event ?? null;
    const yrs = birth?.dateYear || death?.dateYear ? `${birth?.dateYear ?? "?"} – ${death?.dateYear ?? ""}` : "";
    hits.push({
      type: "person",
      id: p.id,
      label: (death ? "† " : "") + displayName(p.names),
      sub: [p.gender.toLowerCase(), yrs].filter(Boolean).join(" · "),
      href: `${base}/people/${p.id}`,
      icon: p.gender === "FEMALE" ? "♀" : p.gender === "MALE" ? "♂" : "•",
    });
  }
  for (const f of families) {
    const a = f.partner1 ? displayName(f.partner1.names) : "?";
    const b = f.partner2 ? displayName(f.partner2.names) : "?";
    hits.push({ type: "family", id: f.id, label: `${a} & ${b}`, sub: "family", href: `${base}/families/${f.id}`, icon: "⚭" });
  }
  for (const m of memorials) {
    hits.push({
      type: "memorial",
      id: m.slug,
      label: m.headline ?? displayName(m.person.names),
      sub: m.published ? "memorial · public" : "memorial · draft",
      href: `/m/${m.slug}`,
      icon: "🕯",
    });
  }
  for (const c of clans) {
    hits.push({ type: "clan", id: c.id, label: c.name, sub: [c.community, "clan"].filter(Boolean).join(" · "), href: `${base}/clans`, icon: "🪶" });
  }
  for (const pl of places) {
    hits.push({ type: "place", id: pl.id, label: pl.title, sub: "place", href: `${base}/places`, icon: "📍" });
  }
  return hits;
}

/** People across every tree the user can access. */
export async function searchAcrossTrees(userId: string, qRaw: string): Promise<SearchHit[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const like = { contains: q, mode: "insensitive" as const };
  const people = await db.person.findMany({
    where: {
      tree: { workspace: { memberships: { some: { userId } } } },
      names: { some: { OR: [{ first: like }, { surname: like }] } },
    },
    select: {
      id: true,
      treeId: true,
      gender: true,
      names: { select: NAME_SELECT },
      tree: { select: { name: true } },
      eventRefs: {
        where: { event: { type: { in: ["Death", "Burial"] } } },
        select: { id: true },
      },
    },
    take: 20,
  });
  return people.map((p) => ({
    type: "person",
    id: p.id,
    label: (p.eventRefs.length > 0 ? "† " : "") + displayName(p.names),
    sub: p.tree.name,
    href: `/trees/${p.treeId}/people/${p.id}`,
    icon: p.gender === "FEMALE" ? "♀" : p.gender === "MALE" ? "♂" : "•",
  }));
}
