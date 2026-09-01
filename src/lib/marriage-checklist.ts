import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";

export type MarriageStep = {
  key: string;
  done: boolean;
  label: string;
  href: string;
  cta: string;
};

const PARTNER = {
  id: true,
  living: true,
  clanId: true,
  claimedByUserId: true,
  names: { select: NAME_SELECT },
  eventRefs: {
    where: { event: { is: { type: { in: ["Birth", "Death", "Burial"] } } } },
    select: { event: { select: { type: true, dateYear: true } } },
  },
  claimInvites: { where: { revokedAt: null, usedAt: null }, select: { id: true } },
};

type Partner = {
  id: string;
  clanId: string | null;
  claimedByUserId: string | null;
  names: { first: string | null }[];
  eventRefs: { event: { type: string; dateYear: number | null } }[];
  claimInvites: { id: string }[];
};

/**
 * Follow-ups after a couple / marriage is recorded. Returns null until the
 * family unit has two partners. Each step's done-state is read from real data.
 */
export async function marriageSteps(
  treeId: string,
  familyId: string,
): Promise<{ steps: MarriageStep[]; doneCount: number; label: string } | null> {
  const fam = await db.family.findFirst({
    where: { id: familyId, treeId },
    select: {
      partner1: { select: PARTNER },
      partner2: { select: PARTNER },
      _count: { select: { mediaRefs: true } },
      eventRefs: {
        where: { event: { type: "Marriage" } },
        select: { event: { select: { dateYear: true, placeId: true } } },
      },
    },
  });
  if (!fam?.partner1 || !fam?.partner2) return null;

  const p1 = fam.partner1 as unknown as Partner;
  const p2 = fam.partner2 as unknown as Partner;
  const person = (id: string) => `/trees/${treeId}/people/${id}`;
  const evType = (p: Partner, t: string) => p.eventRefs.some((r) => r.event.type === t);
  const bornYear = (p: Partner) =>
    p.eventRefs.find((r) => r.event.type === "Birth")?.event.dateYear ?? null;
  const deceased = (p: Partner) => evType(p, "Death") || evType(p, "Burial");
  const firstName = (p: Partner) => p.names.some((n) => !!n.first);
  const marr = fam.eventRefs[0]?.event;

  const claimable = [p1, p2].find(
    (p) => !deceased(p) && !p.claimedByUserId && p.claimInvites.length === 0,
  );

  const steps: MarriageStep[] = [
    {
      key: "names",
      done: firstName(p1) && firstName(p2),
      label: "Both partners have a full name",
      href: `/trees/${treeId}/families/${familyId}`,
      cta: "Edit",
    },
    {
      key: "wedding",
      done: !!(marr?.dateYear || marr?.placeId),
      label: "Wedding date and place recorded",
      href: `/trees/${treeId}/families/${familyId}`,
      cta: "Add",
    },
    {
      key: "births",
      done: [p1, p2].every((p) => bornYear(p) != null || deceased(p)),
      label: "Both partners' birth details",
      href: person(bornYear(p1) == null ? p1.id : p2.id),
      cta: "Add",
    },
    {
      key: "clans",
      done: [p1, p2].every((p) => !!p.clanId),
      label: "Clan noted for both — so the bloodline / clan check works",
      href: person(!p1.clanId ? p1.id : p2.id),
      cta: "Set clan",
    },
    {
      key: "photo",
      done: fam._count.mediaRefs > 0,
      label: "A wedding photo attached",
      href: `/trees/${treeId}/media`,
      cta: "Add photo",
    },
    ...(claimable
      ? [
          {
            key: "claim",
            done: false,
            label: `Invite ${displayName(claimable.names as never)} to claim their profile`,
            href: person(claimable.id),
            cta: "Invite",
          },
        ]
      : []),
  ];

  return {
    steps,
    doneCount: steps.filter((s) => s.done).length,
    label: `${displayName(p1.names as never)} & ${displayName(p2.names as never)}`,
  };
}
