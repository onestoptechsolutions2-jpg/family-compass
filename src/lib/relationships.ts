import { db } from "@/lib/db";
import { dateSortKey } from "@/lib/date";
import { NAME_SELECT } from "@/lib/person";

/**
 * Relationships as shared history.
 *
 * The truth of a relationship is the list of Memory rows two people both
 * appear in (plus, later, threads and prompt answers). RelationEdge only
 * *caches* a derived score so we can sort and visualise; nothing here ever
 * asks a person to rate a relationship on a scale.
 */

export const RELATION_ROLES = [
  "friend",
  "best-friend",
  "chosen-sibling",
  "mentor",
  "mentee",
  "elder", // the "auntie/uncle" who isn't blood
  "co-parent",
  "neighbour",
  "colleague",
  "community",
] as const;
export type RelationRole = (typeof RELATION_ROLES)[number];

/**
 * How a tie came to be. Free text is the primary record ("my father worked
 * with him at KPLC"); this is the optional structured tag alongside it, plus
 * an optional `via` person — the one it came through. Inherited-vs-self-made
 * is a headline research signal.
 */
export const RELATION_CONTEXTS = [
  "family",
  "school",
  "work",
  "church",
  "neighbourhood",
  "friend-of-friend",
  "community",
  "online",
  "other",
] as const;
export type RelationContext = (typeof RELATION_CONTEXTS)[number];

export type RelationOrigin = {
  text?: string | null;
  context?: string | null;
  viaPersonId?: string | null;
  at?: string | null;
};

export type RelationKind = "KIN" | "CHOSEN" | "BOTH";

/** Canonical unordered pair (matches RelationEdge.aPersonId < bPersonId). */
export function orderPair(p1: string, p2: string): [string, string] {
  return p1 < p2 ? [p1, p2] : [p2, p1];
}

/** Only the origin fields actually supplied — so a role edit never wipes a
 *  previously recorded origin story. `null` clears a field; `undefined` skips. */
function normaliseOrigin(o: RelationOrigin | undefined) {
  const out: {
    originText?: string | null;
    originContext?: string | null;
    originViaPersonId?: string | null;
    originAt?: string | null;
  } = {};
  if (!o) return out;
  if (o.text !== undefined) out.originText = o.text?.trim().slice(0, 2000) || null;
  if (o.context !== undefined) out.originContext = o.context || null;
  if (o.viaPersonId !== undefined) out.originViaPersonId = o.viaPersonId || null;
  if (o.at !== undefined) out.originAt = o.at?.trim().slice(0, 120) || null;
  return out;
}

export type ScoreInputs = {
  /** number of memories both people appear in */
  memories: number;
  /** how many of those the two of them have personally confirmed / annotated */
  confirmations: number;
  /** both sides have independently named the tie */
  reciprocated: boolean;
  /** most recent shared memory / interaction */
  lastInteractionAt: Date | null;
};

/**
 * Closeness, derived. Volume of shared memories, lifted when both people put
 * their own words to them and when the tie is named from both sides, then
 * decayed by how long it's been. Pure + deterministic so it can be tested and
 * recomputed cheaply.
 */
export function relationScore(x: ScoreInputs): number {
  const base = x.memories + x.confirmations * 0.5;
  const mutual = x.reciprocated ? 1.5 : 1;
  const days =
    x.lastInteractionAt == null
      ? Infinity
      : Math.max(0, (Date.now() - x.lastInteractionAt.getTime()) / 86_400_000);
  const recency = days === Infinity ? 0.3 : Math.exp(-days / 540); // ~18-month half-life-ish
  const score = base * mutual * (0.4 + 0.6 * recency);
  return Math.round(score * 100) / 100;
}

const sharedWhere = (treeId: string, a: string, b: string) => ({
  treeId,
  AND: [
    { participants: { some: { personId: a } } },
    { participants: { some: { personId: b } } },
  ],
});

/**
 * Recompute and upsert the cached RelationEdge for one pair from its shared
 * memories + assertions. Safe to call repeatedly; call it after any change to
 * a shared memory or an assertion.
 */
export async function recomputeEdge(treeId: string, p1: string, p2: string): Promise<void> {
  if (p1 === p2) return;
  const [a, b] = orderPair(p1, p2);

  const memories = await db.memory.findMany({
    where: sharedWhere(treeId, a, b),
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      updatedAt: true,
      participants: { where: { personId: { in: [a, b] } }, select: { confirmedAt: true } },
    },
  });

  const count = memories.length;
  const confirmations = memories.reduce(
    (n, m) => n + m.participants.filter((p) => p.confirmedAt).length,
    0,
  );
  const firstMemoryAt = memories[0]?.createdAt ?? null;
  const lastInteractionAt = memories.reduce<Date | null>((acc, m) => {
    const t = m.updatedAt > m.createdAt ? m.updatedAt : m.createdAt;
    return !acc || t > acc ? t : acc;
  }, null);

  const existing = await db.relationEdge.findUnique({
    where: { aPersonId_bPersonId: { aPersonId: a, bPersonId: b } },
    select: { id: true, seededById: true, assertions: { select: { byPersonId: true, role: true } } },
  });

  const asserters = new Set(existing?.assertions.map((x) => x.byPersonId));
  const reciprocated = asserters.has(a) && asserters.has(b);
  const roles = [
    ...new Set(existing?.assertions.map((x) => x.role).filter((r): r is string => !!r)),
  ];

  // nothing shared and nobody named it → drop the cached edge
  if (count === 0 && (!existing || existing.assertions.length === 0)) {
    if (existing) await db.relationEdge.delete({ where: { id: existing.id } });
    return;
  }

  const score = relationScore({ memories: count, confirmations, reciprocated, lastInteractionAt });
  const kind: RelationKind = roles.some((r) => r === "chosen-sibling" || r === "co-parent")
    ? "CHOSEN"
    : "CHOSEN";

  await db.relationEdge.upsert({
    where: { aPersonId_bPersonId: { aPersonId: a, bPersonId: b } },
    create: { treeId, aPersonId: a, bPersonId: b, kind, roles, firstMemoryAt, lastInteractionAt, score },
    update: { roles, firstMemoryAt, lastInteractionAt, score },
  });
}

export type AddMemoryInput = {
  treeId: string;
  title: string;
  body?: string | null;
  dateText?: string | null;
  placeId?: string | null;
  eventId?: string | null;
  /** everyone the memory is about (2+ makes it a shared memory) */
  participantIds: string[];
  createdById?: string | null;
};

/** Create a memory, tag its people, and refresh every affected edge. */
export async function addMemory(input: AddMemoryInput): Promise<string> {
  const ids = [...new Set(input.participantIds)].filter(Boolean);
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error("A memory needs a title");

  const memory = await db.memory.create({
    data: {
      treeId: input.treeId,
      title,
      body: input.body?.trim().slice(0, 8000) || null,
      dateText: input.dateText?.trim().slice(0, 120) || null,
      dateSortKey: input.dateText ? dateSortKey({ dateText: input.dateText }) : null,
      placeId: input.placeId || null,
      eventId: input.eventId || null,
      createdById: input.createdById || null,
      participants: {
        create: ids.map((personId) => ({ personId, addedById: input.createdById || null })),
      },
    },
    select: { id: true },
  });

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      await recomputeEdge(input.treeId, ids[i]!, ids[j]!);
    }
  }
  return memory.id;
}

/** A participant adds their own account of a shared memory (and/or confirms it). */
export async function addMemorySide(
  treeId: string,
  memoryId: string,
  personId: string,
  note: string | null,
  confirm: boolean,
): Promise<void> {
  const mp = await db.memoryParticipant.update({
    where: { memoryId_personId: { memoryId, personId } },
    data: {
      note: note?.trim().slice(0, 8000) || null,
      confirmedAt: confirm ? new Date() : null,
    },
    select: { memory: { select: { participants: { select: { personId: true } } } } },
  });
  for (const other of mp.memory.participants) {
    if (other.personId !== personId) await recomputeEdge(treeId, personId, other.personId);
  }
}

/**
 * Name a tie from one side. Reciprocity (both sides asserting) is what lifts
 * the edge — a lone assertion barely moves it.
 */
export async function assertRelation(input: {
  treeId: string;
  fromPersonId: string;
  toPersonId: string;
  role: string;
  strengthHint?: number | null;
  origin?: RelationOrigin;
}): Promise<void> {
  const { treeId, fromPersonId, toPersonId } = input;
  if (fromPersonId === toPersonId) throw new Error("Pick a different person");
  const [a, b] = orderPair(fromPersonId, toPersonId);

  const o = normaliseOrigin(input.origin);

  const edge = await db.relationEdge.upsert({
    where: { aPersonId_bPersonId: { aPersonId: a, bPersonId: b } },
    create: { treeId, aPersonId: a, bPersonId: b, kind: "CHOSEN", roles: [input.role], ...o },
    update: o,
    select: { id: true },
  });

  await db.relationAssertion.upsert({
    where: { edgeId_byPersonId: { edgeId: edge.id, byPersonId: fromPersonId } },
    create: {
      edgeId: edge.id,
      byPersonId: fromPersonId,
      role: input.role,
      strengthHint: input.strengthHint ?? null,
    },
    update: { role: input.role, strengthHint: input.strengthHint ?? null, assertedAt: new Date() },
  });

  await recomputeEdge(treeId, a, b);
}

/** Record or revise just the origin story of a tie (no role change). */
export async function setRelationOrigin(
  treeId: string,
  p1: string,
  p2: string,
  origin: RelationOrigin,
): Promise<void> {
  const [a, b] = orderPair(p1, p2);
  const o = normaliseOrigin(origin);
  await db.relationEdge.upsert({
    where: { aPersonId_bPersonId: { aPersonId: a, bPersonId: b } },
    create: { treeId, aPersonId: a, bPersonId: b, kind: "CHOSEN", ...o },
    update: o,
  });
}

const PERSON_MINI = {
  id: true,
  gender: true,
  names: { select: NAME_SELECT },
} as const;

/** Every chosen/kin edge for a person, closest first, each with its evidence. */
export async function personCircle(treeId: string, personId: string) {
  const edges = await db.relationEdge.findMany({
    where: { treeId, OR: [{ aPersonId: personId }, { bPersonId: personId }] },
    orderBy: { score: "desc" },
    select: {
      id: true,
      kind: true,
      roles: true,
      score: true,
      firstMemoryAt: true,
      lastInteractionAt: true,
      originText: true,
      originContext: true,
      originAt: true,
      originVia: { select: PERSON_MINI },
      aPerson: { select: PERSON_MINI },
      bPerson: { select: PERSON_MINI },
      assertions: { select: { byPersonId: true } },
    },
  });

  return Promise.all(
    edges.map(async (e) => {
      const other = e.aPerson.id === personId ? e.bPerson : e.aPerson;
      const memories = await db.memory.count({
        where: sharedWhere(treeId, personId, other.id),
      });
      const asserters = new Set(e.assertions.map((x) => x.byPersonId));
      return {
        edgeId: e.id,
        person: other,
        kind: e.kind as RelationKind,
        roles: e.roles,
        score: e.score,
        memories,
        firstMemoryAt: e.firstMemoryAt,
        lastInteractionAt: e.lastInteractionAt,
        reciprocated: asserters.size >= 2,
        origin: {
          text: e.originText,
          context: e.originContext,
          at: e.originAt,
          via: e.originVia,
        },
      };
    }),
  );
}

/** Every memory a person appears in, newest first. */
export function personMemories(treeId: string, personId: string) {
  return db.memory.findMany({
    where: { treeId, participants: { some: { personId } } },
    orderBy: [{ dateSortKey: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      body: true,
      dateText: true,
      createdAt: true,
      place: { select: { title: true } },
      participants: {
        select: {
          personId: true,
          note: true,
          confirmedAt: true,
          person: { select: PERSON_MINI },
        },
      },
    },
  });
}

/** The memories two people share, newest first. */
export function sharedMemories(treeId: string, p1: string, p2: string) {
  return db.memory.findMany({
    where: sharedWhere(treeId, p1, p2),
    orderBy: [{ dateSortKey: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      dateText: true,
      createdAt: true,
      place: { select: { title: true } },
      participants: {
        select: { personId: true, note: true, confirmedAt: true, person: { select: PERSON_MINI } },
      },
    },
  });
}
