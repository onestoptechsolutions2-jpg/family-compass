import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { ensureIdentityForPerson } from "@/lib/identity";
import { notifyTreeManagers } from "@/lib/notify";

// ---------------------------------------------------------------------------
// Marriage bridges between Identities — see docs/relationship-rules.md §
// "Why marriage *is* stored again at the Identity level". A MARRIAGE
// IdentityRelationship starts PROPOSED (one tree asserted it) and only
// unlocks cross-tree visibility once CONFIRMED by the other side — this is
// the consent gate, not a side effect of any other action (never automatic).
// ---------------------------------------------------------------------------

export type ProposeMarriageLinkInput = {
  treeId: string;
  personId: string;
  familyId: string;
  actorId: string;
};

/** Propose that this Person's marriage (their Family union with a partner)
 *  bridges to the partner's Identity — i.e. "this couple's two trees are
 *  the same real family." Idempotent: reuses an existing relationship
 *  between the same two Identities rather than creating a duplicate. */
export async function proposeMarriageLink(
  input: ProposeMarriageLinkInput,
): Promise<{ relationshipId: string; alreadyExisted: boolean }> {
  const family = await db.family.findFirst({
    where: { id: input.familyId, treeId: input.treeId },
    select: { partner1Id: true, partner2Id: true },
  });
  if (!family) throw new Error("Family union not found in this tree");

  const partnerId = family.partner1Id === input.personId ? family.partner2Id : family.partner1Id;
  if (!partnerId) throw new Error("This family union doesn't have a second partner yet");

  const myIdentityId = await ensureIdentityForPerson(input.personId);
  const partnerIdentityId = await ensureIdentityForPerson(partnerId);
  if (myIdentityId === partnerIdentityId) throw new Error("You and your partner are already the same identity");

  const aIdentityId = myIdentityId < partnerIdentityId ? myIdentityId : partnerIdentityId;
  const bIdentityId = myIdentityId < partnerIdentityId ? partnerIdentityId : myIdentityId;
  const existing = await db.identityRelationship.findUnique({
    where: { aIdentityId_bIdentityId_kind: { aIdentityId, bIdentityId, kind: "MARRIAGE" } },
    select: { id: true },
  });
  if (existing) return { relationshipId: existing.id, alreadyExisted: true };

  const rel = await db.identityRelationship.create({
    data: {
      aIdentityId,
      bIdentityId,
      kind: "MARRIAGE",
      status: "PROPOSED",
      sourceTreeId: input.treeId,
      sourceFamilyId: input.familyId,
      assertedById: input.actorId,
    },
    select: { id: true },
  });

  const otherTrees = await db.person.findMany({
    where: { identityId: partnerIdentityId, treeId: { not: input.treeId } },
    select: { treeId: true },
    distinct: ["treeId"],
  });
  for (const t of otherTrees) {
    await notifyTreeManagers(t.treeId, {
      kind: "identity.marriage_proposed",
      title: "A family wants to connect",
      body: "A relative linked their family tree to yours through a marriage — confirm it to share a read-only family view both ways, or dispute it if that's not right.",
      linkPath: `/trees/${t.treeId}/merges`,
    });
  }

  return { relationshipId: rel.id, alreadyExisted: false };
}

/** Confirm or dispute a proposed marriage link. The deciding Tree must have
 *  a Person linked to one of the two Identities — i.e. "the other side." */
export async function decideMarriageLink(
  relationshipId: string,
  treeId: string,
  decision: "confirm" | "dispute",
): Promise<void> {
  const rel = await db.identityRelationship.findUniqueOrThrow({
    where: { id: relationshipId },
    select: { id: true, kind: true, aIdentityId: true, bIdentityId: true, status: true },
  });
  if (rel.kind !== "MARRIAGE") throw new Error("Not a marriage link");
  if (rel.status === "CONFIRMED" && decision === "confirm") return; // idempotent

  const inThisTree = await db.person.count({
    where: { treeId, identityId: { in: [rel.aIdentityId, rel.bIdentityId] } },
  });
  if (inThisTree === 0) throw new Error("Your tree isn't part of this relationship");

  await db.identityRelationship.update({
    where: { id: relationshipId },
    data:
      decision === "confirm"
        ? { status: "CONFIRMED", confirmedAt: new Date() }
        : { status: "DISPUTED" },
  });
}

/** Proposed marriage links awaiting this Tree's decision — i.e. the other
 *  side proposed it, and a Person here is the counterparty. */
export async function pendingMarriageLinksFor(treeId: string) {
  const identityIds = await db.person.findMany({
    where: { treeId, identityId: { not: null } },
    select: { identityId: true },
    distinct: ["identityId"],
  });
  const ids = identityIds.map((r) => r.identityId!).filter(Boolean);
  if (ids.length === 0) return [];

  const rels = await db.identityRelationship.findMany({
    where: {
      kind: "MARRIAGE",
      status: "PROPOSED",
      OR: [{ aIdentityId: { in: ids } }, { bIdentityId: { in: ids } }],
      sourceTreeId: { not: treeId },
    },
    select: {
      id: true,
      createdAt: true,
      sourceTreeId: true,
      aIdentity: { select: { displayName: true, people: { take: 1, select: { names: { select: NAME_SELECT } } } } },
      bIdentity: { select: { displayName: true, people: { take: 1, select: { names: { select: NAME_SELECT } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const treeIds = [...new Set(rels.map((r) => r.sourceTreeId).filter((id): id is string => !!id))];
  const trees = treeIds.length
    ? await db.tree.findMany({ where: { id: { in: treeIds } }, select: { id: true, name: true } })
    : [];
  const treeName = new Map(trees.map((t) => [t.id, t.name]));

  return rels.map((r) => ({ ...r, sourceTreeName: r.sourceTreeId ? treeName.get(r.sourceTreeId) ?? null : null }));
}

export type MarriageLinkStatus = {
  relationshipId: string;
  status: "PROPOSED" | "CONFIRMED" | "DISPUTED";
  proposedByThisTree: boolean;
  otherTreeNames: string[];
} | null;

/** The marriage-link status between a Family's two partners, from this
 *  tree's point of view — null if no link has ever been proposed. */
export async function marriageLinkStatusForFamily(
  treeId: string,
  familyId: string,
): Promise<MarriageLinkStatus> {
  const family = await db.family.findFirst({
    where: { id: familyId, treeId },
    select: {
      partner1: { select: { identityId: true } },
      partner2: { select: { identityId: true } },
    },
  });
  const idA = family?.partner1?.identityId;
  const idB = family?.partner2?.identityId;
  if (!idA || !idB || idA === idB) return null;

  const [aIdentityId, bIdentityId] = idA < idB ? [idA, idB] : [idB, idA];
  const rel = await db.identityRelationship.findUnique({
    where: { aIdentityId_bIdentityId_kind: { aIdentityId, bIdentityId, kind: "MARRIAGE" } },
    select: { id: true, status: true, sourceTreeId: true },
  });
  if (!rel) return null;

  const otherTrees = await db.person.findMany({
    where: { identityId: { in: [aIdentityId, bIdentityId] }, treeId: { not: treeId } },
    select: { tree: { select: { name: true } } },
    distinct: ["treeId"],
  });

  return {
    relationshipId: rel.id,
    status: rel.status as "PROPOSED" | "CONFIRMED" | "DISPUTED",
    proposedByThisTree: rel.sourceTreeId === treeId,
    otherTreeNames: otherTrees.map((t) => t.tree.name),
  };
}

// ---------------------------------------------------------------------------
// Read-only cross-tree display — never copies data into the viewer's own
// Family/ChildRef rows. See the "why marriage is stored again" note above:
// this is exactly the bridging visibility a CONFIRMED edge unlocks.
// ---------------------------------------------------------------------------

export type ConnectedChild = { personId: string; treeId: string; name: string; redacted: boolean };
export type ConnectedFamilyEntry = {
  spouseIdentityId: string;
  spousePersonId: string;
  spouseTreeId: string;
  spouseTreeName: string;
  spouseName: string;
  spouseRedacted: boolean;
  children: ConnectedChild[];
};

/** For a Person, every spouse + children reachable through a CONFIRMED
 *  marriage link whose Person rows live in a DIFFERENT tree than this one —
 *  same-tree spouses/children are already visible locally, no need to
 *  duplicate them here. Respects Privacy same as the rest of the app:
 *  PRIVATE is excluded entirely, REDACTED shows no identifying detail. */
export async function connectedFamilyAcrossTrees(
  personId: string,
  viewerTreeId: string,
): Promise<ConnectedFamilyEntry[]> {
  const person = await db.person.findUnique({ where: { id: personId }, select: { identityId: true } });
  if (!person?.identityId) return [];

  const rels = await db.identityRelationship.findMany({
    where: {
      kind: "MARRIAGE",
      status: "CONFIRMED",
      OR: [{ aIdentityId: person.identityId }, { bIdentityId: person.identityId }],
    },
    select: { aIdentityId: true, bIdentityId: true },
  });
  if (rels.length === 0) return [];

  const spouseIdentityIds = [
    ...new Set(rels.map((r) => (r.aIdentityId === person.identityId ? r.bIdentityId : r.aIdentityId))),
  ];

  const entries: ConnectedFamilyEntry[] = [];
  for (const spouseIdentityId of spouseIdentityIds) {
    const spousePeople = await db.person.findMany({
      where: { identityId: spouseIdentityId, treeId: { not: viewerTreeId } },
      select: {
        id: true,
        treeId: true,
        privacy: true,
        names: { select: NAME_SELECT },
        tree: { select: { name: true } },
        familiesAsPartner1: {
          select: { childRefs: { select: { person: { select: { id: true, treeId: true, privacy: true, names: { select: NAME_SELECT } } } } } },
        },
        familiesAsPartner2: {
          select: { childRefs: { select: { person: { select: { id: true, treeId: true, privacy: true, names: { select: NAME_SELECT } } } } } },
        },
      },
    });

    for (const sp of spousePeople) {
      if (sp.privacy === "PRIVATE") continue;
      const redacted = sp.privacy === "REDACTED";
      const families = [...sp.familiesAsPartner1, ...sp.familiesAsPartner2];
      const children: ConnectedChild[] = families
        .flatMap((f) => f.childRefs.map((cr) => cr.person))
        .filter((c) => c.privacy !== "PRIVATE")
        .map((c) => ({
          personId: c.id,
          treeId: c.treeId,
          name: c.privacy === "REDACTED" ? "a family member" : displayName(c.names),
          redacted: c.privacy === "REDACTED",
        }));

      entries.push({
        spouseIdentityId,
        spousePersonId: sp.id,
        spouseTreeId: sp.treeId,
        spouseTreeName: sp.tree.name,
        spouseName: redacted ? "a family member" : displayName(sp.names),
        spouseRedacted: redacted,
        children,
      });
    }
  }
  return entries;
}
