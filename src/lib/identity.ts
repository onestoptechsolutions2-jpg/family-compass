import { Gender } from "@prisma/client";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { displayName, NAME_SELECT } from "@/lib/person";
import { normalizeClan } from "@/lib/clan";
import { searchDirectory, type DirectoryQuery } from "@/lib/discovery";
import { normalizePhone, isValidPhone, claimCode } from "@/lib/wa";
import { linkToken, randomToken, slugify } from "@/lib/slug";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { createBarePerson, setVitalEvent } from "@/lib/person-write";
import { logActivity } from "@/lib/activity";
import { resolveOrCreateWaUser, type ApproveResult } from "@/lib/claims";

const SIGNIN_TOKEN_DAYS = 14;

// ===========================================================================
// Matching — see docs/identity-dedup-claim-workflow.md §1
// ===========================================================================

/** Dice's coefficient over character bigrams — tolerant of spelling/order drift. */
function diceCoefficient(a: string, b: string): number {
  const bigrams = (s: string) => {
    const t = s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
    const grams = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) grams.add(t.slice(i, i + 2));
    return grams;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return A.size === B.size ? 1 : 0;
  let overlap = 0;
  for (const g of A) if (B.has(g)) overlap++;
  return (2 * overlap) / (A.size + B.size);
}

export function nameSimilarity(query: string, candidate: string): number {
  return Math.round(diceCoefficient(query, candidate) * 40);
}

export function birthYearProximity(queryYear: number | null, candidateYear: number | null): number {
  if (queryYear == null || candidateYear == null) return 0; // unknown — neutral, not penalized
  const diff = Math.abs(queryYear - candidateYear);
  if (diff === 0) return 20;
  if (diff <= 2) return 10;
  if (diff <= 5) return 5;
  return 0;
}

export function clanOrCommunityMatch(
  queryClan: string | null,
  queryCommunity: string | null,
  candidateClan: string | null,
  candidateCommunity: string | null,
): number {
  if (queryClan && candidateClan && normalizeClan(queryClan) === normalizeClan(candidateClan)) return 15;
  if (
    queryCommunity &&
    candidateCommunity &&
    queryCommunity.trim().toLowerCase() === candidateCommunity.trim().toLowerCase()
  )
    return 15;
  return 0;
}

export function regionMatch(queryRegion: string | null, candidateRegion: string | null): number {
  if (!queryRegion || !candidateRegion) return 0;
  return candidateRegion.toLowerCase().includes(queryRegion.trim().toLowerCase()) ? 10 : 0;
}

export type IdentityCandidate = {
  personId: string;
  /** null when the matched Person hasn't been linked to a global Identity yet */
  identityId: string | null;
  treeId: string;
  treeName: string;
  name: string;
  clan: string | null;
  community: string | null;
  region: string | null;
  birthYear: number | null;
  living: boolean;
  score: number;
  tier: "likely" | "possible";
};

/**
 * Score every directory candidate against a query person. Only >=30 is
 * returned at all; >=70 is "likely", the rest "possible" — see
 * docs/identity-dedup-claim-workflow.md for the tiers and rationale.
 *
 * `knownRelativeIdentityIds` — Identities the searcher has already named as
 * relatives (e.g. a claimed parent/spouse). A CONFIRMED IdentityRelationship
 * between a candidate and one of these is the strongest signal there is —
 * it alone can carry a weak name match into "likely".
 */
export async function matchIdentityCandidates(
  query: DirectoryQuery & { name: string },
  opts?: { knownRelativeIdentityIds?: string[] },
): Promise<IdentityCandidate[]> {
  const raw = await searchDirectory(query);
  if (raw.length === 0) return [];

  const personIds = raw.map((c) => c.personId);
  const linked = await db.person.findMany({
    where: { id: { in: personIds } },
    select: { id: true, identityId: true },
  });
  const identityByPerson = new Map(linked.map((p) => [p.id, p.identityId]));

  const relatives = new Set(opts?.knownRelativeIdentityIds ?? []);
  const candidateIdentityIds = [...new Set([...identityByPerson.values()].filter((v): v is string => !!v))];

  const confirmedWithRelative = new Set<string>();
  if (relatives.size > 0 && candidateIdentityIds.length > 0) {
    const rels = await db.identityRelationship.findMany({
      where: {
        status: "CONFIRMED",
        OR: [
          { aIdentityId: { in: candidateIdentityIds }, bIdentityId: { in: [...relatives] } },
          { bIdentityId: { in: candidateIdentityIds }, aIdentityId: { in: [...relatives] } },
        ],
      },
      select: { aIdentityId: true, bIdentityId: true },
    });
    for (const r of rels) {
      if (relatives.has(r.aIdentityId)) confirmedWithRelative.add(r.bIdentityId);
      if (relatives.has(r.bIdentityId)) confirmedWithRelative.add(r.aIdentityId);
    }
  }

  const scored = raw.map((c) => {
    const identityId = identityByPerson.get(c.personId) ?? null;
    let score = nameSimilarity(query.name, c.name);
    score += birthYearProximity(query.birthYear ?? null, c.birthYear);
    score += clanOrCommunityMatch(query.clan ?? null, query.community ?? null, c.clan, c.community);
    score += regionMatch(query.region ?? null, c.region);
    if (identityId && confirmedWithRelative.has(identityId)) score += 40;

    return {
      personId: c.personId,
      identityId,
      treeId: c.treeId,
      treeName: c.treeName,
      name: c.name,
      clan: c.clan,
      community: c.community,
      region: c.region,
      birthYear: c.birthYear,
      living: c.living,
      score: Math.round(score),
    };
  });

  return scored
    .filter((s) => s.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((s) => ({ ...s, tier: s.score >= 70 ? ("likely" as const) : ("possible" as const) }));
}

// ===========================================================================
// Identity linking — metadata only, never copies facts, never grants access
// ===========================================================================

/** Get-or-create the global Identity for a Person. Idempotent. Linking a
 *  Person to an Identity is pure bookkeeping — it never changes who can see
 *  or edit that Person's tree. */
export async function ensureIdentityForPerson(personId: string): Promise<string> {
  const person = await db.person.findUniqueOrThrow({
    where: { id: personId },
    select: {
      identityId: true,
      gender: true,
      names: { select: NAME_SELECT },
      eventRefs: {
        where: { event: { is: { type: "Birth" } } },
        select: { event: { select: { dateYear: true } } },
        take: 1,
      },
    },
  });
  if (person.identityId) return person.identityId;

  const identity = await db.identity.create({
    data: {
      displayName: displayName(person.names) || null,
      genderHint: person.gender === Gender.UNKNOWN ? null : person.gender,
      birthYearHint: person.eventRefs[0]?.event.dateYear ?? null,
    },
    select: { id: true },
  });
  await db.person.update({ where: { id: personId }, data: { identityId: identity.id } });
  return identity.id;
}

// ===========================================================================
// Onboarding provisioning — the NEW_IDENTITY_CREATED / IDENTITY_CLAIMED tail
// of docs/onboarding-state-machine.md. A fresh personal Workspace + Tree +
// self-Person, whether the human is brand new to the platform (mints a new
// Identity) or was just matched/claimed (links to the existing one).
// ===========================================================================

export type ProvisionSelfTreeInput = {
  identityId?: string; // pre-existing Identity to link (claimed path); omit to mint a new one
  first?: string;
  surname?: string;
  gender?: Gender;
  birthYear?: number;
  community?: string | null;
  region?: string | null;
  phone?: string | null;
};

export async function provisionSelfTree(
  userId: string,
  claimantName: string,
  opts: ProvisionSelfTreeInput,
): Promise<{ treeId: string; personId: string; identityId: string }> {
  // Idempotent: `Person.claimedByUserId` is globally unique, so a user can
  // only ever have one self-Person. If they already have one (e.g. this is
  // a second identity claim on an existing account, reached outside the
  // normal one-time-onboarding path), link it instead of trying to create a
  // second one — which would otherwise crash on the unique constraint.
  const existingSelf = await db.person.findFirst({
    where: { claimedByUserId: userId },
    select: { id: true, treeId: true, identityId: true },
  });
  if (existingSelf) {
    if (opts.identityId && existingSelf.identityId && existingSelf.identityId !== opts.identityId) {
      throw new Error("This account is already linked to a different identity.");
    }
    const identityId = existingSelf.identityId ?? opts.identityId ?? (await ensureIdentityForPerson(existingSelf.id));
    if (!existingSelf.identityId) {
      await db.person.update({ where: { id: existingSelf.id }, data: { identityId } });
    }
    return { treeId: existingSelf.treeId, personId: existingSelf.id, identityId };
  }

  await ensurePersonalWorkspace(userId, claimantName);
  const ws = await db.membership.findFirstOrThrow({
    where: { userId, role: "OWNER" },
    select: { workspaceId: true },
  });

  const first = opts.first ?? claimantName.split(" ")[0] ?? claimantName;
  const base = slugify(`${first}-family`) || "family";
  let treeSlug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await db.tree.findFirst({
      where: { workspaceId: ws.workspaceId, slug: treeSlug },
      select: { id: true },
    });
    if (!clash) break;
    treeSlug = `${base}-${randomToken(4)}`;
  }

  const tree = await db.tree.create({
    data: {
      workspaceId: ws.workspaceId,
      adminUserId: userId,
      name: `${first}'s family`,
      slug: treeSlug,
      community: opts.community || null,
      region: opts.region || null,
    },
    select: { id: true },
  });

  const person = await createBarePerson(tree.id, {
    first,
    surname: opts.surname,
    gender: opts.gender,
    living: true,
  });
  if (opts.birthYear) {
    await setVitalEvent(tree.id, person.id, "Birth", String(opts.birthYear), "");
  }

  const identityId = opts.identityId ?? (await ensureIdentityForPerson(person.id));
  if (opts.identityId) {
    await db.person.update({ where: { id: person.id }, data: { identityId: opts.identityId } });
  }

  await db.tree.update({ where: { id: tree.id }, data: { homePersonId: person.id } });
  await db.person.update({
    where: { id: person.id },
    data: { claimedByUserId: userId, phone: opts.phone ?? undefined },
  });

  await logActivity({
    treeId: tree.id,
    actorId: userId,
    verb: "created",
    objectType: "tree",
    objectId: tree.id,
    summary: `${claimantName} started their family tree`,
  });

  return { treeId: tree.id, personId: person.id, identityId };
}

// ===========================================================================
// Claim — extends PersonClaim with targetIdentityId. See
// docs/identity-dedup-claim-workflow.md §2. Rejection reuses rejectClaim from
// lib/claims (it only touches PersonClaim.status, personId or not).
// ===========================================================================

export type RequestIdentityClaimInput = {
  candidatePersonId: string;
  claimantName: string;
  phone: string;
  note?: string;
};

export type RequestIdentityClaimResult = {
  claimId: string;
  code: string;
  contactWhatsapp: string | null;
  treeName: string;
};

/** File a self-claim against an existing, unclaimed Identity found during
 *  onboarding search. Never grants access to the matched tree — it only
 *  proposes "I am this human," pending verification by that tree's admin. */
export async function requestIdentityClaim(
  input: RequestIdentityClaimInput,
): Promise<RequestIdentityClaimResult> {
  const name = input.claimantName.trim();
  if (name.length < 2) throw new Error("Enter your name");
  if (!isValidPhone(input.phone)) throw new Error("Enter a valid WhatsApp number");
  const phone = normalizePhone(input.phone);

  const person = await db.person.findUnique({
    where: { id: input.candidatePersonId },
    select: {
      id: true,
      treeId: true,
      names: { select: { surname: true, preferred: true, type: true, order: true } },
      eventRefs: { where: { event: { is: { type: { in: ["Death", "Burial"] } } } }, select: { id: true } },
      tree: { select: { name: true, contactWhatsapp: true } },
    },
  });
  if (!person) throw new Error("That profile no longer exists");
  if (person.eventRefs.length > 0) throw new Error("That profile is recorded as deceased");

  const identityId = await ensureIdentityForPerson(person.id);
  const identity = await db.identity.findUniqueOrThrow({
    where: { id: identityId },
    select: { claimedByUserId: true },
  });
  if (identity.claimedByUserId) throw new Error("Someone has already claimed this identity");

  const dupe = await db.personClaim.findFirst({
    where: { targetIdentityId: identityId, status: "PENDING" },
    select: { id: true },
  });
  if (dupe) throw new Error("There is already a pending claim for this identity");

  const surnameHint = person.names.find((n) => n.preferred)?.surname ?? person.names[0]?.surname ?? null;

  const claim = await db.personClaim.create({
    data: {
      treeId: person.treeId,
      personId: null,
      targetIdentityId: identityId,
      claimantName: name,
      phone,
      note: input.note?.trim() || null,
      code: claimCode(surnameHint),
      status: "PENDING",
    },
    select: { id: true, code: true },
  });

  await logActivity({
    treeId: person.treeId,
    verb: "requested",
    objectType: "claim",
    objectId: claim.id,
    summary: `${name} asked to claim a linked identity`,
  });

  return {
    claimId: claim.id,
    code: claim.code,
    contactWhatsapp: person.tree.contactWhatsapp,
    treeName: person.tree.name,
  };
}

/**
 * Approve an identity claim: find-or-create the claimant's account, link the
 * Identity to them (if not already claimed), provision their OWN personal
 * Workspace/Tree/self-Person linked to that Identity — and nothing else.
 * Unlike approveClaim's personId path, this never touches the matched
 * tree's Person row, never sets its claimedByUserId, and never grants the
 * claimant Membership on that tree's Workspace: claiming an Identity means
 * "I am this human," not "I inherit this family's data." See
 * docs/onboarding-state-machine.md ("why a claimed Identity still gets its
 * own new Workspace/Tree").
 */
export async function approveIdentityClaim(
  treeId: string,
  claimId: string,
  actorId: string,
): Promise<ApproveResult> {
  const claim = await db.personClaim.findFirst({
    where: { id: claimId, treeId },
    select: {
      id: true,
      status: true,
      targetIdentityId: true,
      claimantName: true,
      phone: true,
      signInToken: true,
    },
  });
  if (!claim || !claim.targetIdentityId) throw new Error("Claim not found");
  if (claim.status === "APPROVED") {
    return {
      phone: claim.phone,
      name: claim.claimantName,
      signInUrl: `${await publicOrigin()}/api/auth/wa/${claim.signInToken}`,
    };
  }
  if (claim.status !== "PENDING") throw new Error("This claim can't be approved");

  const identityId = claim.targetIdentityId;
  const identity = await db.identity.findUniqueOrThrow({
    where: { id: identityId },
    select: { claimedByUserId: true },
  });

  const { id: userId } = await resolveOrCreateWaUser(claim.phone, claim.claimantName);

  if (identity.claimedByUserId && identity.claimedByUserId !== userId) {
    throw new Error("This identity has already been claimed by someone else");
  }
  if (!identity.claimedByUserId) {
    // Identity.claimedByUserId is globally unique too — a user can only ever
    // claim one Identity. Check before writing rather than let the unique
    // constraint turn a real conflict into a raw 500.
    const otherClaim = await db.identity.findUnique({
      where: { claimedByUserId: userId },
      select: { id: true },
    });
    if (otherClaim && otherClaim.id !== identityId) {
      throw new Error("This account already claims a different identity.");
    }
    await db.identity.update({ where: { id: identityId }, data: { claimedByUserId: userId } });
  }

  const provisioned = await provisionSelfTree(userId, claim.claimantName, {
    identityId,
    phone: claim.phone,
  });

  const signInToken = linkToken();
  await db.personClaim.update({
    where: { id: claim.id },
    data: {
      status: "APPROVED",
      decidedById: actorId,
      decidedAt: new Date(),
      createdUserId: userId,
      signInToken,
      signInTokenExpiresAt: new Date(Date.now() + SIGNIN_TOKEN_DAYS * 864e5),
      signInTokenUsedAt: null,
    },
  });

  await db.auditLog.create({
    data: {
      treeId,
      actorId,
      action: "identity_claim.approved",
      targetType: "Identity",
      targetId: identityId,
      meta: { claimId: claim.id, userId, selfTreeId: provisioned.treeId, selfPersonId: provisioned.personId },
    },
  });

  await logActivity({
    treeId,
    actorId,
    verb: "approved",
    objectType: "claim",
    objectId: claim.id,
    summary: `approved ${claim.claimantName}'s identity claim`,
  });

  return {
    phone: claim.phone,
    name: claim.claimantName,
    signInUrl: `${await publicOrigin()}/api/auth/wa/${signInToken}`,
  };
}
