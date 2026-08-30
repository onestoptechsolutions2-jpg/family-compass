import { db } from "@/lib/db";
import { displayName, presumedLiving } from "@/lib/person";
import { formatDate, dateSortKey } from "@/lib/date";
import { buildEulogyDraft, type EulogyFacts } from "@/lib/eulogy";

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
const MINI = { id: true, living: true, privacy: true, names: { select: NAME_SELECT } } as const;

export type ProgramItem = { title: string; detail?: string };

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
          reviewedBy: { select: { name: true, email: true } },
        },
      },
      program: {
        select: {
          id: true,
          venue: true,
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
        select: { id: true, name: true, relation: true, message: true, status: true, createdAt: true },
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
      program: { select: { venue: true, serviceDate: true, committee: true, order: true } },
      guestbook: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, relation: true, message: true, createdAt: true },
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

  const kin: { id: string; name: string; living: boolean; private: boolean }[] = [];
  const push = (p?: { id: string; living: boolean; privacy: string; names: unknown[] } | null) => {
    if (!p) return;
    kin.push({
      id: p.id,
      name: displayName(p.names as never),
      living: p.living,
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

  const survivors = kin.filter((k) => k.living && !k.private).map((k) => k.name);
  const preceded = kin.filter((k) => !k.living && !k.private).map((k) => k.name);

  const events = m.person.eventRefs.map((r) => r.event);
  const birth = events.find((e) => e.type === "Birth");
  const death = events.find((e) => e.type === "Death");

  return {
    ...m,
    name: displayName(m.person.names),
    born: m.bornText || (birth ? formatDate(birth) : ""),
    bornPlace: birth?.place?.title ?? "",
    died: m.diedText || (death ? formatDate(death) : ""),
    diedPlace: death?.place?.title ?? "",
    survivors: [...new Set(survivors)],
    preceded: [...new Set(preceded)],
    photos: m.person.mediaRefs
      .map((r) => r.media)
      .filter((x) => x.mimeType.startsWith("image/")),
    program: m.program
      ? {
          ...m.program,
          order: (m.program.order as ProgramItem[]) ?? [],
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
      program: { select: { venue: true, serviceDate: true, committee: true, order: true } },
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

  const kin: { name: string; living: boolean; private: boolean }[] = [];
  const push = (p?: { living: boolean; privacy: string; names: unknown[] } | null) => {
    if (!p) return;
    kin.push({ name: displayName(p.names as never), living: p.living, private: p.privacy === "PRIVATE" });
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
      ? [...new Set(kin.filter((k) => k.living && !k.private).map((k) => k.name))]
      : [],
    preceded: [...new Set(kin.filter((k) => !k.living && !k.private).map((k) => k.name))],
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
          serviceDate: m.program.serviceDate,
          committee: m.program.committee,
          order: (m.program.order as ProgramItem[]) ?? [],
        }
      : null,
  };
}

/** Collect structured facts for the eulogy-draft generator. */
export async function gatherEulogyFacts(
  treeId: string,
  personId: string,
): Promise<EulogyFacts | null> {
  const p = await db.person.findFirst({
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
  });
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

export { presumedLiving };
