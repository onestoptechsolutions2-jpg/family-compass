import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { displayName, NAME_SELECT, presumedLiving } from "@/lib/person";
import { formatDate, dateSortKey } from "@/lib/date";
import { buildEulogyDraft, type EulogyFacts } from "@/lib/eulogy";

const MINI = {
  id: true,
  living: true,
  privacy: true,
  names: { select: NAME_SELECT },
  // a recorded Death/Burial is the only reliable "deceased" signal —
  // Person.living defaults to false on import.
  eventRefs: {
    where: { event: { is: { type: { in: ["Death", "Burial"] } } } },
    select: { id: true },
  },
} satisfies Prisma.PersonSelect;

/** True only when the person has a recorded Death or Burial event. */
function kinDeceased(p: { eventRefs?: { id: string }[] } | null | undefined): boolean {
  return !!p?.eventRefs && p.eventRefs.length > 0;
}

export type ProgramItem = {
  id: string;
  day?: string;
  title: string;
  detail?: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
};

/** Normalise stored order JSON (older rows may lack id/day/location). */
export function normaliseOrder(raw: unknown): ProgramItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    return {
      id: typeof o.id === "string" && o.id ? o.id : `it${i}`,
      day: typeof o.day === "string" && o.day.trim() ? o.day.trim() : undefined,
      title: String(o.title ?? "").trim(),
      detail: typeof o.detail === "string" && o.detail.trim() ? o.detail.trim() : undefined,
      lat: num(o.lat),
      lng: num(o.lng),
      mapUrl: typeof o.mapUrl === "string" && o.mapUrl.trim() ? o.mapUrl.trim() : undefined,
    };
  }).filter((x) => x.title);
}

/** Group items by their day label, preserving order; undated go under "Programme". */
export function groupByDay(items: ProgramItem[]): { day: string; items: ProgramItem[] }[] {
  const out: { day: string; items: ProgramItem[] }[] = [];
  for (const it of items) {
    const key = it.day ?? "Programme";
    let bucket = out.find((b) => b.day === key);
    if (!bucket) {
      bucket = { day: key, items: [] };
      out.push(bucket);
    }
    bucket.items.push(it);
  }
  return out;
}

export async function getMemorialForEditor(treeId: string, personId: string) {
  return db.memorial.findFirst({
    where: { personId, treeId },
    select: {
      id: true,
      slug: true,
      headline: true,
      eulogy: true,
      bornText: true,
      diedText: true,
      restingPlace: true,
      serviceText: true,
      coverMediaId: true,
      published: true,
      guestbookOpen: true,
      guestbookModerated: true,
      includeLiving: true,
      template: true,
      bioNotes: true,
      groupContribToken: true,
      viewCount: true,
      status: true,
      lockedAt: true,
      finalisedAt: true,
      lockedBy: { select: { name: true, email: true } },
      contributors: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          relation: true,
          token: true,
          lastSeenAt: true,
          createdAt: true,
          _count: { select: { contributions: true } },
        },
      },
      contributions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          authorName: true,
          section: true,
          body: true,
          status: true,
          createdAt: true,
          photoMediaIds: true,
          reviewedBy: { select: { name: true, email: true } },
        },
      },
      program: {
        select: {
          id: true,
          venue: true,
          venueLat: true,
          venueLng: true,
          venueMapUrl: true,
          serviceDate: true,
          committee: true,
          order: true,
          updatedAt: true,
          updatedBy: { select: { name: true, email: true } },
          revisions: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              note: true,
              createdAt: true,
              editedBy: { select: { name: true, email: true } },
            },
          },
        },
      },
      guestbook: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          relation: true,
          message: true,
          status: true,
          createdAt: true,
          replies: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, message: true, status: true, createdAt: true },
          },
          _count: { select: { reactions: true } },
        },
      },
      flowers: {
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, kind: true, name: true, hidden: true, createdAt: true },
      },
      _count: { select: { flowers: { where: { hidden: false } } } },
      chamaFund: {
        select: {
          id: true,
          label: true,
          publicToken: true,
          targetKes: true,
          status: true,
          contributions: {
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              contributorName: true,
              amountKes: true,
              method: true,
              status: true,
              mpesaCode: true,
              note: true,
              createdAt: true,
              confirmedAt: true,
            },
          },
        },
      },
    },
  });
}

export async function getPublicMemorial(slug: string) {
  const m = await db.memorial.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      published: true,
      headline: true,
      eulogy: true,
      bornText: true,
      diedText: true,
      restingPlace: true,
      serviceText: true,
      coverMediaId: true,
      guestbookOpen: true,
      guestbookModerated: true,
      includeLiving: true,
      template: true,
      treeId: true,
      tree: { select: { name: true } },
      person: {
        select: {
          id: true,
          living: true,
          names: { select: NAME_SELECT },
          eventRefs: {
            select: {
              event: {
                select: {
                  type: true,
                  dateYear: true,
                  dateModifier: true,
                  dateQuality: true,
                  dateMonth: true,
                  dateDay: true,
                  dateText: true,
                  place: { select: { title: true } },
                },
              },
            },
          },
          mediaRefs: {
            select: { media: { select: { id: true, mimeType: true, fileName: true } } },
          },
        },
      },
      program: { select: { venue: true, venueLat: true, venueLng: true, venueMapUrl: true, serviceDate: true, committee: true, order: true } },
      guestbook: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          relation: true,
          message: true,
          createdAt: true,
          replies: {
            where: { status: "APPROVED" },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, message: true, createdAt: true },
          },
          reactions: { select: { emoji: true } },
        },
      },
      flowers: {
        where: { hidden: false },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { id: true, kind: true, name: true, createdAt: true },
      },
      _count: { select: { flowers: { where: { hidden: false } } } },
      chamaFund: {
        select: {
          publicToken: true,
          label: true,
          targetKes: true,
          status: true,
          contributions: {
            where: { status: "CONFIRMED" },
            select: { amountKes: true },
          },
        },
      },
    },
  });
  if (!m) return null;

  const rel = await db.person.findUnique({
    where: { id: m.person.id },
    select: {
      childRefs: {
        select: {
          family: { select: { partner1: { select: MINI }, partner2: { select: MINI } } },
        },
      },
      familiesAsPartner1: { select: { partner2: { select: MINI }, childRefs: { select: { person: { select: MINI } } } } },
      familiesAsPartner2: { select: { partner1: { select: MINI }, childRefs: { select: { person: { select: MINI } } } } },
    },
  });

  const kin: { name: string; deceased: boolean; private: boolean }[] = [];
  const push = (
    p?: { privacy: string; names: unknown[]; eventRefs?: { id: string }[] } | null,
  ) => {
    if (!p) return;
    kin.push({
      name: displayName(p.names as never),
      deceased: kinDeceased(p),
      private: p.privacy === "PRIVATE",
    });
  };
  rel?.childRefs.forEach((c) => {
    push(c.family.partner1);
    push(c.family.partner2);
  });
  rel?.familiesAsPartner1.forEach((f) => {
    push(f.partner2);
    f.childRefs.forEach((c) => push(c.person));
  });
  rel?.familiesAsPartner2.forEach((f) => {
    push(f.partner1);
    f.childRefs.forEach((c) => push(c.person));
  });

  const survivors = kin.filter((k) => !k.deceased && !k.private).map((k) => k.name);
  const preceded = kin.filter((k) => k.deceased && !k.private).map((k) => k.name);

  const events = m.person.eventRefs.map((r) => r.event);
  const birth = events.find((e) => e.type === "Birth");
  const death = events.find((e) => e.type === "Death");

  const welfareFund =
    m.chamaFund && (m.chamaFund.status === "OPEN" || m.chamaFund.contributions.length > 0)
      ? {
          token: m.chamaFund.publicToken,
          label: m.chamaFund.label,
          targetKes: m.chamaFund.targetKes,
          open: m.chamaFund.status === "OPEN",
          raisedKes: m.chamaFund.contributions.reduce((s, c) => s + c.amountKes, 0),
        }
      : null;

  return {
    ...m,
    name: displayName(m.person.names),
    born: m.bornText || (birth ? formatDate(birth) : ""),
    bornPlace: birth?.place?.title ?? "",
    died: m.diedText || (death ? formatDate(death) : ""),
    diedPlace: death?.place?.title ?? "",
    welfareFund,
    survivors: [...new Set(survivors)],
    preceded: [...new Set(preceded)],
    photos: m.person.mediaRefs
      .map((r) => r.media)
      .filter((x) => x.mimeType.startsWith("image/")),
    program: m.program
      ? {
          ...m.program,
          order: normaliseOrder(m.program.order),
        }
      : null,
  };
}

/** Flat payload for the printable memorial / eulogy book (MEMORIAL_BOOK generation). */
export async function getMemorialBookData(treeId: string, personId: string) {
  const m = await db.memorial.findFirst({
    where: { personId, treeId },
    select: {
      id: true,
      slug: true,
      headline: true,
      eulogy: true,
      bornText: true,
      diedText: true,
      restingPlace: true,
      serviceText: true,
      coverMediaId: true,
      includeLiving: true,
      template: true,
      person: {
        select: {
          id: true,
          subClan: true,
          names: { select: NAME_SELECT },
          clan: { select: { name: true, community: true, origin: true } },
          eventRefs: {
            select: {
              event: {
                select: {
                  type: true,
                  description: true,
                  dateYear: true,
                  dateModifier: true,
                  dateQuality: true,
                  dateMonth: true,
                  dateDay: true,
                  dateText: true,
                  place: { select: { title: true } },
                },
              },
            },
          },
          mediaRefs: {
            take: 12,
            select: { caption: true, media: { select: { id: true, mimeType: true } } },
          },
        },
      },
      program: { select: { venue: true, venueLat: true, venueLng: true, venueMapUrl: true, serviceDate: true, committee: true, order: true } },
      guestbook: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: { name: true, relation: true, message: true, createdAt: true },
      },
    },
  });
  if (!m) return null;

  const rel = await db.person.findUnique({
    where: { id: m.person.id },
    select: {
      childRefs: {
        select: { family: { select: { partner1: { select: MINI }, partner2: { select: MINI } } } },
      },
      familiesAsPartner1: { select: { partner2: { select: MINI }, childRefs: { select: { person: { select: MINI } } } } },
      familiesAsPartner2: { select: { partner1: { select: MINI }, childRefs: { select: { person: { select: MINI } } } } },
    },
  });

  const kin: { name: string; deceased: boolean; private: boolean }[] = [];
  const push = (
    p?: { privacy: string; names: unknown[]; eventRefs?: { id: string }[] } | null,
  ) => {
    if (!p) return;
    kin.push({
      name: displayName(p.names as never),
      deceased: kinDeceased(p),
      private: p.privacy === "PRIVATE",
    });
  };
  const parents: string[] = [];
  const spouses: string[] = [];
  const children: string[] = [];
  const nameOf = (p?: { names: unknown[] } | null) => (p ? displayName(p.names as never) : null);

  rel?.childRefs.forEach((c) => {
    push(c.family.partner1);
    push(c.family.partner2);
    [c.family.partner1, c.family.partner2].forEach((p) => {
      const n = nameOf(p);
      if (n) parents.push(n);
    });
  });
  rel?.familiesAsPartner1.forEach((f) => {
    push(f.partner2);
    const s = nameOf(f.partner2);
    if (s) spouses.push(s);
    f.childRefs.forEach((c) => {
      push(c.person);
      const n = nameOf(c.person);
      if (n) children.push(n);
    });
  });
  rel?.familiesAsPartner2.forEach((f) => {
    push(f.partner1);
    const s = nameOf(f.partner1);
    if (s) spouses.push(s);
    f.childRefs.forEach((c) => {
      push(c.person);
      const n = nameOf(c.person);
      if (n) children.push(n);
    });
  });

  const events = m.person.eventRefs.map((r) => r.event);
  const birth = events.find((e) => e.type === "Birth");
  const death = events.find((e) => e.type === "Death") ?? events.find((e) => e.type === "Burial");

  const timeline = events
    .filter((e) => e.dateYear || e.dateText || e.place || e.description)
    .map((e) => ({
      type: e.type,
      date: formatDate(e),
      place: e.place?.title ?? null,
      note: e.description ?? null,
      _k: dateSortKey(e),
    }))
    .sort((a, b) => a._k.localeCompare(b._k))
    .map(({ _k, ...r }) => {
      void _k;
      return r;
    });

  return {
    memorialId: m.id,
    slug: m.slug,
    name: displayName(m.person.names),
    headline: m.headline,
    eulogy: m.eulogy,
    serviceText: m.serviceText,
    restingPlace: m.restingPlace,
    coverMediaId: m.coverMediaId,
    template: m.template,
    clan: m.person.clan?.name ?? null,
    subClan: m.person.subClan ?? null,
    community: m.person.clan?.community ?? null,
    clanOrigin: m.person.clan?.origin ?? null,
    born: m.bornText || (birth ? formatDate(birth) : ""),
    died: m.diedText || (death ? formatDate(death) : ""),
    bornPlace: birth?.place?.title ?? null,
    diedPlace: death?.place?.title ?? null,
    parents: [...new Set(parents)],
    spouses: [...new Set(spouses)],
    children: [...new Set(children)],
    survivors: m.includeLiving
      ? [...new Set(kin.filter((k) => !k.deceased && !k.private).map((k) => k.name))]
      : [],
    preceded: [...new Set(kin.filter((k) => k.deceased && !k.private).map((k) => k.name))],
    timeline,
    photos: m.person.mediaRefs
      .filter((r) => r.media.mimeType.startsWith("image/"))
      .map((r) => ({ id: r.media.id, mime: r.media.mimeType, caption: r.caption ?? null })),
    guestbook: m.guestbook.map((g) => ({
      name: g.name,
      relation: g.relation,
      message: g.message,
      date: g.createdAt.toISOString().slice(0, 10),
    })),
    program: m.program
      ? {
          venue: m.program.venue,
          venueMapUrl:
            m.program.venueMapUrl ??
            (m.program.venueLat != null && m.program.venueLng != null
              ? `https://www.google.com/maps?q=${m.program.venueLat},${m.program.venueLng}`
              : null),
          serviceDate: m.program.serviceDate,
          committee: m.program.committee,
          order: normaliseOrder(m.program.order),
        }
      : null,
  };
}

/** Collect structured facts for the eulogy-draft generator. */
export async function gatherEulogyFacts(
  treeId: string,
  personId: string,
): Promise<EulogyFacts | null> {
  const [p, mem] = await Promise.all([
    db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      gender: true,
      subClan: true,
      clan: { select: { name: true, community: true } },
      names: { select: NAME_SELECT },
      eventRefs: {
        select: {
          event: {
            select: {
              type: true,
              dateYear: true,
              dateMonth: true,
              dateDay: true,
              dateModifier: true,
              dateQuality: true,
              dateText: true,
              place: { select: { title: true } },
            },
          },
        },
      },
      childRefs: {
        select: { family: { select: { partner1: { select: MINI }, partner2: { select: MINI } } } },
      },
      familiesAsPartner1: {
        select: { partner2: { select: MINI }, childRefs: { select: { person: { select: MINI } } } },
      },
      familiesAsPartner2: {
        select: { partner1: { select: MINI }, childRefs: { select: { person: { select: MINI } } } },
      },
    },
    }),
    db.memorial.findFirst({ where: { personId, treeId }, select: { bioNotes: true } }),
  ]);
  if (!p) return null;

  const events = p.eventRefs.map((r) => r.event);
  const birth = events.find((e) => e.type === "Birth");
  const death = events.find((e) => e.type === "Death") ?? events.find((e) => e.type === "Burial");
  const nameOf = (x: { names: unknown[] } | null | undefined) => (x ? displayName(x.names as never) : null);

  const parents = [
    ...p.childRefs.flatMap((c) => [nameOf(c.family.partner1), nameOf(c.family.partner2)]),
  ].filter(Boolean) as string[];
  const spouses = [
    ...p.familiesAsPartner1.map((f) => nameOf(f.partner2)),
    ...p.familiesAsPartner2.map((f) => nameOf(f.partner1)),
  ].filter(Boolean) as string[];
  const children = [
    ...p.familiesAsPartner1.flatMap((f) => f.childRefs.map((c) => nameOf(c.person))),
    ...p.familiesAsPartner2.flatMap((f) => f.childRefs.map((c) => nameOf(c.person))),
  ].filter(Boolean) as string[];

  const age =
    birth?.dateYear && death?.dateYear && death.dateYear >= birth.dateYear
      ? death.dateYear - birth.dateYear
      : null;

  return {
    name: displayName(p.names),
    given: displayName(p.names).split(" ")[0] ?? null,
    gender: p.gender,
    bornDate: birth ? formatDate(birth) : null,
    bornPlace: birth?.place?.title ?? null,
    diedDate: death ? formatDate(death) : null,
    diedPlace: death?.place?.title ?? null,
    ageYears: age,
    clan: p.clan?.name ?? null,
    subClan: p.subClan ?? null,
    community: p.clan?.community ?? null,
    parents: [...new Set(parents)],
    spouses: [...new Set(spouses)],
    children: [...new Set(children)],
    siblingsCount: null,
    notes: (mem?.bioNotes as EulogyFacts["notes"]) ?? null,
  };
}

/** Generate an editable first-draft eulogy string from the tree records. */
export async function draftEulogyText(treeId: string, personId: string): Promise<string | null> {
  const facts = await gatherEulogyFacts(treeId, personId);
  return facts ? buildEulogyDraft(facts) : null;
}

export function isDeceased(events: { type: string }[]): boolean {
  return events.some((e) => e.type === "Death" || e.type === "Burial");
}

/**
 * If a guestbook signer's typed name matches exactly one person in the tree,
 * work out how they relate to the deceased. Returns null when there's no
 * confident match (0 matches, or ambiguous).
 */
export async function resolveGuestRelationship(
  treeId: string,
  deceasedPersonId: string,
  rawName: string,
): Promise<{ personId: string; label: string } | null> {
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;

  const rows = await db.person.findMany({
    where: {
      treeId,
      names: {
        some: {
          AND: [
            { first: { equals: first, mode: "insensitive" } },
            { surname: { equals: last, mode: "insensitive" } },
          ],
        },
      },
    },
    select: { id: true, gender: true },
    take: 3,
  });
  if (rows.length !== 1) return null;
  const match = rows[0]!;
  if (match.id === deceasedPersonId) return { personId: match.id, label: "the person being remembered" };

  const { getTreeGraph } = await import("@/lib/queries/graph");
  const { bloodRelationship, kinTermToward } = await import("@/lib/kinship");
  const { affinalRelationship } = await import("@/lib/affinity");

  const graph = await getTreeGraph(treeId, deceasedPersonId);
  const k = bloodRelationship(graph, match.id, deceasedPersonId);
  if (k.related) {
    const term = kinTermToward(k, match.gender);
    if (term) return { personId: match.id, label: term };
  }
  const aff = affinalRelationship(graph, match.id, deceasedPersonId);
  if (aff.found) return { personId: match.id, label: aff.aToB.en };

  return { personId: match.id, label: "a member of this family" };
}

/** The most recently updated published memorials — for the small "recent" ribbon. */
export async function getRecentMemorials(limit = 3, exceptSlug?: string) {
  const rows = await db.memorial.findMany({
    where: { published: true, ...(exceptSlug ? { slug: { not: exceptSlug } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      slug: true,
      headline: true,
      coverMediaId: true,
      person: { select: { names: { select: NAME_SELECT } } },
    },
  });
  return rows.map((r) => ({
    slug: r.slug,
    name: displayName(r.person.names),
    headline: r.headline,
    coverMediaId: r.coverMediaId,
  }));
}

export { presumedLiving };
