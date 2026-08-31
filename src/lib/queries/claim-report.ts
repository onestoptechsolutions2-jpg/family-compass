import { db } from "@/lib/db";
import { displayName } from "@/lib/person";

const NAME_SELECT = {
  first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true,
  preferred: true, type: true, order: true,
} as const;

/**
 * Every profile in a tree, bucketed by account-claim status.
 *
 *  claimed   — bound to a user account
 *  pending   — an unreviewed claim request exists
 *  invited   — a live claim link is out (not yet used / expired)
 *  claimable — living, not deceased, none of the above → can send a link
 *  deceased  — has a Death/Burial event; a memorial, never a claim
 *  unknown   — not marked living and no death recorded — status unclear
 */
export const CLAIM_CATEGORIES = [
  { id: "pending", label: "Awaiting review", hint: "Someone requested this profile — approve or reject in Claims." },
  { id: "invited", label: "Link sent", hint: "A claim link is out; nobody has used it yet." },
  { id: "claimable", label: "Can be claimed", hint: "Living relatives with no account and no link yet." },
  { id: "claimed", label: "Claimed", hint: "Bound to an account." },
  { id: "unknown", label: "Status unclear", hint: "Not marked living and no death recorded." },
  { id: "deceased", label: "Deceased — not claimable", hint: "A memorial, not an account." },
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number]["id"];

export type ClaimReportRow = {
  id: string;
  name: string;
  gender: string;
  category: ClaimCategory;
  claimedByName: string | null;
  inviteToken: string | null;
};

export type ClaimReport = {
  counts: Record<ClaimCategory, number>;
  rows: Record<ClaimCategory, ClaimReportRow[]>;
};

export async function claimStatusReport(treeId: string): Promise<ClaimReport> {
  const now = new Date();
  const people = await db.person.findMany({
    where: { treeId },
    select: {
      id: true,
      gender: true,
      living: true,
      claimedByUserId: true,
      claimedBy: { select: { name: true, email: true } },
      names: { select: NAME_SELECT },
      eventRefs: {
        where: { event: { is: { type: { in: ["Death", "Burial"] } } } },
        select: { id: true },
      },
      claimInvites: {
        where: { revokedAt: null, usedAt: null },
        orderBy: { createdAt: "desc" },
        select: { token: true, expiresAt: true },
      },
      claims: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
  });

  const counts = {} as Record<ClaimCategory, number>;
  const rows = {} as Record<ClaimCategory, ClaimReportRow[]>;
  for (const c of CLAIM_CATEGORIES) {
    counts[c.id] = 0;
    rows[c.id] = [];
  }

  for (const p of people) {
    const deceased = p.eventRefs.length > 0;
    const liveInvite = p.claimInvites.find((i) => !i.expiresAt || i.expiresAt > now) ?? null;

    let category: ClaimCategory;
    if (p.claimedByUserId) category = "claimed";
    else if (deceased) category = "deceased";
    else if (p.claims.length > 0) category = "pending";
    else if (liveInvite) category = "invited";
    else if (p.living) category = "claimable";
    else category = "unknown";

    counts[category] += 1;
    rows[category].push({
      id: p.id,
      name: displayName(p.names),
      gender: p.gender,
      category,
      claimedByName: p.claimedBy?.name ?? p.claimedBy?.email ?? null,
      inviteToken: liveInvite?.token ?? null,
    });
  }

  for (const c of CLAIM_CATEGORIES) {
    rows[c.id].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { counts, rows };
}
