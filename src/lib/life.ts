import { db } from "@/lib/db";
import { NAME_SELECT } from "@/lib/person";

/**
 * "Life now" — an ongoing, updatable status about a person's present.
 * Not history (Event) and not the shared past (Memory) — what's going on
 * right now, in a reel you can scroll back through.
 */

export const LIFE_CATEGORIES = [
  { id: "health", label: "Health", emoji: "🩺" },
  { id: "education", label: "Education", emoji: "🎓" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "faith", label: "Faith", emoji: "🙏" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "milestone", label: "Milestone", emoji: "🎉" },
  { id: "other", label: "Other", emoji: "•" },
] as const;

export type LifeCategory = (typeof LIFE_CATEGORIES)[number]["id"];

const OTHER = { id: "other", label: "Other", emoji: "•" } as const;

export function lifeCategoryMeta(id: string): { id: string; label: string; emoji: string } {
  return LIFE_CATEGORIES.find((c) => c.id === id) ?? OTHER;
}

const isCategory = (v: string): v is LifeCategory =>
  LIFE_CATEGORIES.some((c) => c.id === v);

export type AddLifeUpdateInput = {
  treeId: string;
  personId: string;
  category: string;
  body: string;
  current: boolean;
  since?: string | null;
  createdById?: string | null;
};

/** Post an update. If it's "current now", the previous current update in the
 *  same category steps aside (stays in the reel, no longer live). */
export async function addLifeUpdate(input: AddLifeUpdateInput): Promise<string> {
  const body = input.body.trim().slice(0, 2000);
  if (body.length < 2) throw new Error("Write a little more");
  const category = isCategory(input.category) ? input.category : "other";

  if (input.current) {
    await db.lifeUpdate.updateMany({
      where: { personId: input.personId, category, current: true },
      data: { current: false },
    });
  }

  const row = await db.lifeUpdate.create({
    data: {
      treeId: input.treeId,
      personId: input.personId,
      category,
      body,
      current: input.current,
      since: input.since?.trim().slice(0, 120) || null,
      createdById: input.createdById || null,
    },
    select: { id: true },
  });
  return row.id;
}

/** Mark an update as no longer the case. */
export async function endLifeUpdate(treeId: string, id: string): Promise<void> {
  await db.lifeUpdate.updateMany({ where: { id, treeId }, data: { current: false } });
}

const SELECT = {
  id: true,
  category: true,
  body: true,
  current: true,
  since: true,
  createdAt: true,
  createdBy: { select: { name: true, email: true } },
} as const;

/** The live status per category — for the "Right now" panel and header. */
export async function personLifeNow(personId: string) {
  const rows = await db.lifeUpdate.findMany({
    where: { personId, current: true },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  // one per category (newest wins)
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.category) ? false : (seen.add(r.category), true)));
}

/** The whole reel for one person, newest first. */
export function personLifeReel(personId: string, take = 60) {
  return db.lifeUpdate.findMany({
    where: { personId },
    orderBy: { createdAt: "desc" },
    take,
    select: SELECT,
  });
}

/** The family life reel — everyone's recent updates in one tree. */
export function treeLifeReel(treeId: string, take = 30) {
  return db.lifeUpdate.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      ...SELECT,
      person: { select: { id: true, gender: true, names: { select: NAME_SELECT } } },
    },
  });
}
