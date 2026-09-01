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

/** Human-facing groupings for the activity feed. */
export const ACTIVITY_KINDS = [
  { id: "genealogy", label: "Genealogy", emoji: "🌳" },
  { id: "memorial", label: "Memorials", emoji: "🕯️" },
  { id: "chama", label: "Welfare / chama", emoji: "🤝" },
  { id: "sharing", label: "Sharing & access", emoji: "🔗" },
  { id: "media", label: "Media", emoji: "🖼️" },
  { id: "import", label: "Imports", emoji: "📥" },
  { id: "system", label: "System", emoji: "⚙️" },
  { id: "other", label: "Other", emoji: "•" },
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["id"];

const OBJECT_KIND: Record<string, ActivityKind> = {
  person: "genealogy",
  family: "genealogy",
  event: "genealogy",
  place: "genealogy",
  source: "genealogy",
  citation: "genealogy",
  note: "genealogy",
  clan: "genealogy",
  memory: "genealogy",
  relation: "genealogy",
  memorial: "memorial",
  guestbook: "memorial",
  contribution: "memorial",
  chama: "chama",
  fund: "chama",
  share: "sharing",
  sharedview: "sharing",
  invitation: "sharing",
  claim: "sharing",
  membership: "sharing",
  media: "media",
  import: "import",
  system: "system",
  backup: "system",
  maintenance: "system",
};

/** Map an ActivityEvent.objectType to one of ACTIVITY_KINDS. */
export function activityKind(objectType: string): ActivityKind {
  return OBJECT_KIND[objectType.toLowerCase()] ?? "other";
}

const OTHER_KIND = { id: "other", label: "Other", emoji: "•" } as const;

export function activityKindMeta(id: ActivityKind): { id: string; label: string; emoji: string } {
  return ACTIVITY_KINDS.find((k) => k.id === id) ?? OTHER_KIND;
}
