import { db } from "@/lib/db";

/** Fire-and-forget activity log for the tree "Updates" feed. Never throws. */
export async function logActivity(input: {
  treeId: string;
  actorId?: string | null;
  verb: string;
  objectType: string;
  objectId: string;
  summary: string;
}): Promise<void> {
  try {
    await db.activityEvent.create({
      data: {
        treeId: input.treeId,
        actorId: input.actorId ?? null,
        verb: input.verb,
        objectType: input.objectType,
        objectId: input.objectId,
        summary: input.summary.slice(0, 300),
      },
    });
  } catch (err) {
    console.error("[activity] failed to log", err);
  }
}
