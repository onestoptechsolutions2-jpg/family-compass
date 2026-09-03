import type { IdentityRelationshipKind, IdentityRelationshipStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { displayName, NAME_SELECT } from "@/lib/person";

const GRACE_WINDOW_DAYS = 14;
const STATUS_RANK: Record<IdentityRelationshipStatus, number> = {
  DISPUTED: 0,
  PROPOSED: 1,
  CONFIRMED: 2,
};

type RelationshipSnapshotRow = {
  id: string;
  aIdentityId: string;
  bIdentityId: string;
  kind: IdentityRelationshipKind;
  status: IdentityRelationshipStatus;
  sourceTreeId: string | null;
  sourceFamilyId: string | null;
  assertedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MergeSnapshot = {
  personIds: string[];
  relationships: {
    /** rows whose a/bIdentityId were repointed onto intoIdentityId — undo by restoring these ids */
    repointed: { id: string; prevAIdentityId: string; prevBIdentityId: string }[];
    /** rows deleted (dedup collision, or now-self-referential) — undo by recreating verbatim */
    deleted: RelationshipSnapshotRow[];
  };
  /** set when fromIdentity's claim moved to intoIdentity because intoIdentity was unclaimed */
  claimTransferredFrom: string | null;
};

function snapshotRow(r: {
  id: string;
  aIdentityId: string;
  bIdentityId: string;
  kind: IdentityRelationshipKind;
  status: IdentityRelationshipStatus;
  sourceTreeId: string | null;
  sourceFamilyId: string | null;
  assertedById: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RelationshipSnapshotRow {
  return {
    id: r.id,
    aIdentityId: r.aIdentityId,
    bIdentityId: r.bIdentityId,
    kind: r.kind,
    status: r.status,
    sourceTreeId: r.sourceTreeId,
    sourceFamilyId: r.sourceFamilyId,
    assertedById: r.assertedById,
    confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Every Tree with a Person linked to this Identity — each one's manager must
 *  approve a merge that would move those People off it. See
 *  docs/identity-dedup-claim-workflow.md §3. */
export async function requiredTreesForMerge(
  identityId: string,
): Promise<{ treeId: string; treeName: string }[]> {
  const rows = await db.person.findMany({
    where: { identityId },
    select: { tree: { select: { id: true, name: true } } },
    distinct: ["treeId"],
  });
  return rows.map((r) => ({ treeId: r.tree.id, treeName: r.tree.name }));
}

export type MergeSidePerson = {
  personId: string;
  treeId: string;
  treeName: string;
  name: string;
  birthYear: number | null;
  birthPlace: string | null;
  deathYear: number | null;
  clan: string | null;
  eventCount: number;
  mediaCount: number;
  noteCount: number;
  attributeCount: number;
  /** simple sum of the counts above, plus 1 each for birth/death/clan known —
   *  not a scientific measure, just enough to eyeball "which side has more
   *  filled in" without the admin counting fields themselves */
  detailScore: number;
};

async function personDetailSummary(personId: string): Promise<MergeSidePerson> {
  const p = await db.person.findUniqueOrThrow({
    where: { id: personId },
    select: {
      id: true,
      treeId: true,
      tree: { select: { name: true } },
      names: { select: NAME_SELECT },
      clan: { select: { name: true } },
      eventRefs: {
        select: { event: { select: { type: true, dateYear: true, place: { select: { title: true } } } } },
      },
      _count: { select: { mediaRefs: true, noteRefs: true, attributes: true } },
    },
  });
  const birth = p.eventRefs.find((r) => r.event.type === "Birth")?.event ?? null;
  const death = p.eventRefs.find((r) => r.event.type === "Death")?.event ?? null;
  const detailScore =
    p.eventRefs.length +
    p._count.mediaRefs +
    p._count.noteRefs +
    p._count.attributes +
    (birth ? 1 : 0) +
    (death ? 1 : 0) +
    (p.clan ? 1 : 0);

  return {
    personId: p.id,
    treeId: p.treeId,
    treeName: p.tree.name,
    name: displayName(p.names),
    birthYear: birth?.dateYear ?? null,
    birthPlace: birth?.place?.title ?? null,
    deathYear: death?.dateYear ?? null,
    clan: p.clan?.name ?? null,
    eventCount: p.eventRefs.length,
    mediaCount: p._count.mediaRefs,
    noteCount: p._count.noteRefs,
    attributeCount: p._count.attributes,
    detailScore,
  };
}

/** Every Person linked to an Identity, with just enough detail to eyeball
 *  which side of a proposed merge has more filled in — a side-by-side
 *  reference for the admin reviewing it, never used to decide anything
 *  automatically and never copied into either tree's own records. */
export async function identityMergeDiff(
  fromIdentityId: string,
  intoIdentityId: string,
): Promise<{ from: MergeSidePerson[]; into: MergeSidePerson[] }> {
  const [fromPeople, intoPeople] = await Promise.all([
    db.person.findMany({ where: { identityId: fromIdentityId }, select: { id: true } }),
    db.person.findMany({ where: { identityId: intoIdentityId }, select: { id: true } }),
  ]);
  const [from, into] = await Promise.all([
    Promise.all(fromPeople.map((p) => personDetailSummary(p.id))),
    Promise.all(intoPeople.map((p) => personDetailSummary(p.id))),
  ]);
  return { from, into };
}

/**
 * File a merge proposal. Refuses outright if both Identities are already
 * claimed by different living users — that's not a case this workflow can
 * resolve automatically; it needs a human to sort out which account is
 * right before any merge is safe.
 */
export async function proposeIdentityMerge(input: {
  fromIdentityId: string;
  intoIdentityId: string;
  evidence?: string;
  proposedById: string;
}): Promise<{ id: string }> {
  if (input.fromIdentityId === input.intoIdentityId) {
    throw new Error("Can't merge an identity into itself");
  }

  const [from, into] = await Promise.all([
    db.identity.findUniqueOrThrow({
      where: { id: input.fromIdentityId },
      select: { mergedIntoId: true, claimedByUserId: true },
    }),
    db.identity.findUniqueOrThrow({
      where: { id: input.intoIdentityId },
      select: { mergedIntoId: true, claimedByUserId: true },
    }),
  ]);
  if (from.mergedIntoId) throw new Error("That identity was already merged elsewhere");
  if (into.mergedIntoId) throw new Error("The target identity was already merged elsewhere");
  if (from.claimedByUserId && into.claimedByUserId && from.claimedByUserId !== into.claimedByUserId) {
    throw new Error(
      "Both identities are already claimed by different accounts — this can't be merged automatically. Contact support.",
    );
  }

  const dupe = await db.identityMergeRequest.findFirst({
    where: {
      fromIdentityId: input.fromIdentityId,
      intoIdentityId: input.intoIdentityId,
      status: { in: ["PROPOSED", "CORROBORATING"] },
    },
    select: { id: true },
  });
  if (dupe) throw new Error("A merge request for these two identities is already pending");

  const request = await db.identityMergeRequest.create({
    data: {
      fromIdentityId: input.fromIdentityId,
      intoIdentityId: input.intoIdentityId,
      evidence: input.evidence?.trim() || null,
      proposedById: input.proposedById,
      status: "PROPOSED",
    },
    select: { id: true },
  });
  return request;
}

/**
 * Record one Tree's sign-off. Once every Tree with a Person linked to
 * fromIdentityId has approved, the merge executes immediately as part of
 * this call — see docs/identity-dedup-claim-workflow.md §3 ("Execute (only
 * after full corroboration)"). The 14-day revert window is the safety net
 * for a wrong call, not a manual extra step.
 */
export async function approveIdentityMerge(
  requestId: string,
  treeId: string,
  approvedById: string,
): Promise<{ executed: boolean }> {
  const request = await db.identityMergeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { id: true, fromIdentityId: true, status: true },
  });
  if (request.status !== "PROPOSED" && request.status !== "CORROBORATING") {
    throw new Error("This merge request is no longer open for approval");
  }

  const required = await requiredTreesForMerge(request.fromIdentityId);
  if (!required.some((r) => r.treeId === treeId)) {
    throw new Error("Your tree isn't one that needs to approve this merge");
  }

  await db.identityMergeApproval.upsert({
    where: { requestId_treeId: { requestId, treeId } },
    update: {},
    create: { requestId, treeId, approvedById },
  });

  const approvals = await db.identityMergeApproval.findMany({
    where: { requestId },
    select: { treeId: true },
  });
  const approvedTreeIds = new Set(approvals.map((a) => a.treeId));
  const fullyApproved = required.every((r) => approvedTreeIds.has(r.treeId));

  if (!fullyApproved) {
    if (request.status === "PROPOSED") {
      await db.identityMergeRequest.update({ where: { id: requestId }, data: { status: "CORROBORATING" } });
    }
    await logActivity({
      treeId,
      actorId: approvedById,
      verb: "approved",
      objectType: "identity-merge",
      objectId: requestId,
      summary: "signed off on a proposed identity merge — waiting on other families",
    });
    return { executed: false };
  }

  await executeIdentityMerge(requestId);
  await logActivity({
    treeId,
    actorId: approvedById,
    verb: "approved",
    objectType: "identity-merge",
    objectId: requestId,
    summary: "signed off on a proposed identity merge — all families approved, merge executed",
  });
  return { executed: true };
}

/** Any Tree required to approve this merge can veto it instead — ends the
 *  request outright, same as one family disputing a proposed marriage tie. */
export async function rejectIdentityMerge(
  requestId: string,
  treeId: string,
  actorId: string,
  reason?: string,
): Promise<void> {
  const request = await db.identityMergeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true, fromIdentityId: true },
  });
  if (request.status !== "PROPOSED" && request.status !== "CORROBORATING") {
    throw new Error("This merge request is no longer open");
  }
  const required = await requiredTreesForMerge(request.fromIdentityId);
  if (!required.some((r) => r.treeId === treeId)) {
    throw new Error("Your tree isn't one that needs to approve this merge");
  }

  await db.identityMergeRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
  await logActivity({
    treeId,
    actorId,
    verb: "rejected",
    objectType: "identity-merge",
    objectId: requestId,
    summary: reason ? `rejected a proposed identity merge — ${reason}` : "rejected a proposed identity merge",
  });
}

/** Apply a fully-corroborated merge. Idempotent — a second call on an
 *  already-EXECUTED request is a no-op. See docs/identity-dedup-claim-
 *  workflow.md §3 for the repoint/dedupe/soft-delete rules. */
export async function executeIdentityMerge(requestId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const request = await tx.identityMergeRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { id: true, fromIdentityId: true, intoIdentityId: true, status: true },
    });
    if (request.status === "EXECUTED") return; // already applied
    if (request.status !== "PROPOSED" && request.status !== "CORROBORATING") {
      throw new Error("This merge request can't be executed");
    }
    const { fromIdentityId, intoIdentityId } = request;

    const people = await tx.person.findMany({ where: { identityId: fromIdentityId }, select: { id: true } });

    const fromRels = await tx.identityRelationship.findMany({
      where: { OR: [{ aIdentityId: fromIdentityId }, { bIdentityId: fromIdentityId }] },
    });
    const intoRels = await tx.identityRelationship.findMany({
      where: { OR: [{ aIdentityId: intoIdentityId }, { bIdentityId: intoIdentityId }] },
    });
    const otherSide = (r: { aIdentityId: string; bIdentityId: string }, mine: string) =>
      r.aIdentityId === mine ? r.bIdentityId : r.aIdentityId;
    const intoByKey = new Map(intoRels.map((r) => [`${otherSide(r, intoIdentityId)}:${r.kind}`, r]));

    const repointed: { id: string; prevAIdentityId: string; prevBIdentityId: string }[] = [];
    const deleted: RelationshipSnapshotRow[] = [];

    for (const r of fromRels) {
      const other = otherSide(r, fromIdentityId);
      const isA = r.aIdentityId === fromIdentityId;

      if (other === intoIdentityId) {
        // relationship between the two identities being merged — now self-referential, drop it
        deleted.push(snapshotRow(r));
        await tx.identityRelationship.delete({ where: { id: r.id } });
        continue;
      }

      const collision = intoByKey.get(`${other}:${r.kind}`);
      if (!collision) {
        await tx.identityRelationship.update({
          where: { id: r.id },
          data: isA ? { aIdentityId: intoIdentityId } : { bIdentityId: intoIdentityId },
        });
        repointed.push({ id: r.id, prevAIdentityId: r.aIdentityId, prevBIdentityId: r.bIdentityId });
        continue;
      }

      // dedup: keep whichever row has the higher status, drop the other
      if (STATUS_RANK[r.status] > STATUS_RANK[collision.status]) {
        deleted.push(snapshotRow(collision));
        await tx.identityRelationship.delete({ where: { id: collision.id } });
        await tx.identityRelationship.update({
          where: { id: r.id },
          data: isA ? { aIdentityId: intoIdentityId } : { bIdentityId: intoIdentityId },
        });
        repointed.push({ id: r.id, prevAIdentityId: r.aIdentityId, prevBIdentityId: r.bIdentityId });
      } else {
        deleted.push(snapshotRow(r));
        await tx.identityRelationship.delete({ where: { id: r.id } });
      }
    }

    await tx.person.updateMany({ where: { identityId: fromIdentityId }, data: { identityId: intoIdentityId } });

    const [fromIdentity, intoIdentity] = await Promise.all([
      tx.identity.findUniqueOrThrow({ where: { id: fromIdentityId }, select: { claimedByUserId: true } }),
      tx.identity.findUniqueOrThrow({ where: { id: intoIdentityId }, select: { claimedByUserId: true } }),
    ]);
    let claimTransferredFrom: string | null = null;
    if (fromIdentity.claimedByUserId && !intoIdentity.claimedByUserId) {
      claimTransferredFrom = fromIdentity.claimedByUserId;
      await tx.identity.update({ where: { id: intoIdentityId }, data: { claimedByUserId: claimTransferredFrom } });
    }

    await tx.identity.update({
      where: { id: fromIdentityId },
      data: { mergedIntoId: intoIdentityId, mergedAt: new Date() },
    });

    const snapshot: MergeSnapshot = {
      personIds: people.map((p) => p.id),
      relationships: { repointed, deleted },
      claimTransferredFrom,
    };
    const revertibleUntil = new Date(Date.now() + GRACE_WINDOW_DAYS * 864e5);
    await tx.identityMergeRequest.update({
      where: { id: requestId },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        revertibleUntil,
        snapshot: snapshot as object,
      },
    });
  });
}

/**
 * Undo an executed merge within its 14-day grace window — restores every
 * repointed Person and IdentityRelationship row (and any transferred claim)
 * exactly as they were. Only a Tree manager who approved this specific merge
 * may trigger it. See docs/identity-dedup-claim-workflow.md §3.
 */
export async function revertIdentityMerge(requestId: string, actorId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const request = await tx.identityMergeRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        fromIdentityId: true,
        intoIdentityId: true,
        revertibleUntil: true,
        snapshot: true,
        approvals: { select: { approvedById: true } },
      },
    });
    if (request.status !== "EXECUTED") throw new Error("This merge isn't in a revertible state");
    if (!request.revertibleUntil || request.revertibleUntil.getTime() < Date.now()) {
      throw new Error("The 14-day window to undo this merge has passed");
    }
    if (!request.approvals.some((a) => a.approvedById === actorId)) {
      throw new Error("Only a tree manager who approved this merge can undo it");
    }
    const snap = request.snapshot as unknown as MergeSnapshot | null;
    if (!snap) throw new Error("No snapshot recorded for this merge");

    await tx.person.updateMany({
      where: { id: { in: snap.personIds } },
      data: { identityId: request.fromIdentityId },
    });

    for (const r of snap.relationships.repointed) {
      await tx.identityRelationship.update({
        where: { id: r.id },
        data: { aIdentityId: r.prevAIdentityId, bIdentityId: r.prevBIdentityId },
      });
    }
    for (const row of snap.relationships.deleted) {
      await tx.identityRelationship.create({
        data: {
          id: row.id,
          aIdentityId: row.aIdentityId,
          bIdentityId: row.bIdentityId,
          kind: row.kind,
          status: row.status,
          sourceTreeId: row.sourceTreeId,
          sourceFamilyId: row.sourceFamilyId,
          assertedById: row.assertedById,
          confirmedAt: row.confirmedAt ? new Date(row.confirmedAt) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
      });
    }

    if (snap.claimTransferredFrom) {
      await tx.identity.update({ where: { id: request.intoIdentityId }, data: { claimedByUserId: null } });
      await tx.identity.update({
        where: { id: request.fromIdentityId },
        data: { claimedByUserId: snap.claimTransferredFrom },
      });
    }

    await tx.identity.update({
      where: { id: request.fromIdentityId },
      data: { mergedIntoId: null, mergedAt: null },
    });

    await tx.identityMergeRequest.update({
      where: { id: requestId },
      data: { status: "REVERTED", revertedAt: new Date() },
    });
  });
}
