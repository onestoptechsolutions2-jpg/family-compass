import { db } from "@/lib/db";
import { NAME_SELECT } from "@/lib/person";
import { notifyUser } from "@/lib/notify";

type EventFacts = {
  treeId: string;
  /** the person the event was registered on */
  personId: string;
  /** "Birth" | "Death" | "Burial" | "Marriage" | … */
  eventType: string;
  dateText?: string | null;
  placeText?: string | null;
  /** don't notify the person who registered it */
  actorUserId?: string | null;
};

const VERB: Record<string, string> = {
  Death: "has died",
  Burial: "has been buried",
  Birth: "has been born",
  Baptism: "has been baptised",
  Marriage: "has married",
};

/**
 * When a life event is registered on someone, notify every relative in the
 * same tree who has claimed their own profile. Each notification names the
 * relationship from that recipient's point of view plus the event details.
 * Never throws — notifications are best-effort. Returns the number sent.
 */
export async function notifyRelativesOfEvent(f: EventFacts): Promise<number> {
  try {
    const subject = await db.person.findFirst({
      where: { id: f.personId, treeId: f.treeId },
      select: { id: true, gender: true, names: { select: NAME_SELECT } },
    });
    if (!subject) return 0;

    const claimed = await db.person.findMany({
      where: { treeId: f.treeId, claimedByUserId: { not: null }, id: { not: f.personId } },
      select: { id: true, claimedByUserId: true },
    });
    if (claimed.length === 0) return 0;

    const { getTreeGraph } = await import("@/lib/queries/graph");
    const { bloodRelationship, kinTermToward } = await import("@/lib/kinship");
    const { affinalRelationship } = await import("@/lib/affinity");
    const { displayName } = await import("@/lib/person");

    const graph = await getTreeGraph(f.treeId, f.personId);
    const subjectName = displayName(subject.names);
    const verb = VERB[f.eventType] ?? `has a new ${f.eventType.toLowerCase()} record`;
    const whenWhere = [
      f.dateText?.trim() ? `on ${f.dateText.trim()}` : null,
      f.placeText?.trim() ? `at ${f.placeText.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    // one notification per user — keep the closest relationship if a user
    // has claimed more than one profile in the tree
    type Hit = { userId: string; term: string; closeness: number };
    const best = new Map<string, Hit>();

    for (const rel of claimed) {
      const userId = rel.claimedByUserId;
      if (!userId || userId === f.actorUserId) continue;

      let term: string | null = null;
      let closeness = 999;

      const k = bloodRelationship(graph, f.personId, rel.id);
      if (k.related) {
        term = kinTermToward(k, subject.gender);
        closeness = k.closeness >= 0 ? k.closeness : 999;
      }
      if (!term) {
        const aff = affinalRelationship(graph, f.personId, rel.id);
        if (aff.found) {
          term = aff.aToB.en;
          closeness = 50;
        }
      }
      if (!term) continue;

      const prev = best.get(userId);
      if (!prev || closeness < prev.closeness) best.set(userId, { userId, term, closeness });
    }

    let sent = 0;
    for (const hit of best.values()) {
      await notifyUser(hit.userId, {
        kind: `event.${f.eventType.toLowerCase()}`,
        title: `${subjectName} ${verb}`,
        body: `${subjectName} — your ${hit.term} — ${verb}${whenWhere ? ` ${whenWhere}` : ""}.`,
        treeId: f.treeId,
        linkPath: `/trees/${f.treeId}/people/${f.personId}`,
      });
      sent += 1;
    }
    return sent;
  } catch (err) {
    console.error("[notify-kin] failed", err);
    return 0;
  }
}
