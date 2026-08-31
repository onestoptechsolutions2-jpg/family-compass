import { db } from "@/lib/db";

export type EventCommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  resolvedAt: Date | null;
  author: string;
  resolver: string | null;
};

/** All comments for a set of events, keyed by eventId. */
export async function commentsForEvents(
  eventIds: string[],
): Promise<Map<string, EventCommentRow[]>> {
  const byEvent = new Map<string, EventCommentRow[]>();
  if (eventIds.length === 0) return byEvent;

  const rows = await db.eventComment.findMany({
    where: { eventId: { in: eventIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventId: true,
      body: true,
      createdAt: true,
      resolvedAt: true,
      author: { select: { name: true, email: true } },
      resolver: { select: { name: true, email: true } },
    },
  });

  for (const r of rows) {
    const list = byEvent.get(r.eventId) ?? [];
    list.push({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      author: r.author?.name ?? r.author?.email ?? "Someone",
      resolver: r.resolver?.name ?? r.resolver?.email ?? null,
    });
    byEvent.set(r.eventId, list);
  }
  return byEvent;
}

/** Open (unresolved) discussion count across a tree — for a nav badge. */
export async function openDiscussionCount(treeId: string): Promise<number> {
  return db.eventComment.count({ where: { treeId, resolvedAt: null } });
}
