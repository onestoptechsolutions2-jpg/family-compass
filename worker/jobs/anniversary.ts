import type { Job } from "pg-boss";
import { Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";
import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { collectAnniversaries } from "@/lib/queries/anniversaries";

type Payload = JobPayloads[typeof QUEUE.anniversaryScan];

/** How far ahead to warn the family. */
const LEAD_DAYS = 7;

/** Runs daily. Turns upcoming birthdays / death & wedding anniversaries into
 *  one-per-year in-app notifications for the tree's editors and every relative
 *  who has claimed their profile. */
export async function handleAnniversaryScan(_jobs: Job<Payload>[]) {
  const items = await collectAnniversaries(null, LEAD_DAYS);
  if (items.length === 0) {
    console.log("[anniversary] nothing upcoming");
    return;
  }

  // cache audiences per tree
  const audienceCache = new Map<string, string[]>();
  let sent = 0;

  for (const a of items) {
    const forYear = a.date.getUTCFullYear();

    // dedup: one row per (event, kind, year)
    try {
      await db.anniversaryReminder.create({
        data: { treeId: a.treeId, eventId: a.eventId, kind: a.kind, forYear },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }

    let audience = audienceCache.get(a.treeId);
    if (!audience) {
      audience = await treeAudience(a.treeId);
      audienceCache.set(a.treeId, audience);
    }
    if (audience.length === 0) continue;

    const linkPath =
      a.kind === "wedding" && a.familyId
        ? `/trees/${a.treeId}/families/${a.familyId}`
        : a.personId
          ? `/trees/${a.treeId}/people/${a.personId}`
          : `/trees/${a.treeId}`;

    await db.notification.createMany({
      data: audience.map((userId) => ({
        userId,
        treeId: a.treeId,
        kind: `anniversary.${a.kind}`,
        title: a.title.slice(0, 200),
        body: a.detail.slice(0, 1000),
        linkPath,
      })),
    });
    sent += audience.length;
  }

  console.log(`[anniversary] ${items.length} occasions → ${sent} notifications`);
}

/** Tree editors/owners + everyone in the tree who has claimed their profile. */
async function treeAudience(treeId: string): Promise<string[]> {
  const tree = await db.tree.findUnique({
    where: { id: treeId },
    select: {
      workspace: {
        select: {
          memberships: {
            where: { role: { in: [Role.EDITOR, Role.OWNER] } },
            select: { userId: true },
          },
        },
      },
      people: {
        where: { claimedByUserId: { not: null } },
        select: { claimedByUserId: true },
      },
    },
  });
  if (!tree) return [];
  const ids = new Set<string>();
  for (const m of tree.workspace.memberships) ids.add(m.userId);
  for (const p of tree.people) if (p.claimedByUserId) ids.add(p.claimedByUserId);
  return [...ids];
}
