import { randomBytes } from "node:crypto";
import { ClaimStatus, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { normalizePhone, isValidPhone, claimCode } from "@/lib/wa";
import { verifySharePassword } from "@/lib/share";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

const SIGNIN_TOKEN_DAYS = 14;

/**
 * Create a fresh single-use claim link for `personId`, superseding any live
 * one. Guards: person is in the tree, living, and unclaimed. Returns the new
 * token. Shared by the person page, the "invite relatives" flow, and the
 * claim-status report.
 */
export async function issueClaimInvite(
  treeId: string,
  personId: string,
  note: string | null,
  actorId: string,
): Promise<string> {
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      claimedByUserId: true,
      eventRefs: {
        where: { event: { is: { type: { in: ["Death", "Burial"] } } } },
        select: { id: true },
      },
    },
  });
  if (!person) throw new Error("Person not found in this tree");
  if (person.claimedByUserId) throw new Error("This profile is already claimed");
  if (person.eventRefs.length > 0) throw new Error("This person is recorded as deceased");

  await db.claimInvite.updateMany({
    where: { personId, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date() },
  });
  const token = randomBytes(18).toString("hex");
  await db.claimInvite.create({
    data: {
      treeId,
      personId,
      token,
      note,
      createdById: actorId,
      expiresAt: new Date(Date.now() + 30 * 864e5),
    },
  });
  await logActivity({
    treeId,
    actorId,
    verb: "invited",
    objectType: "person",
    objectId: personId,
    summary: "sent a profile claim link",
  });
  return token;
}

export type RequestClaimInput = {
  slug: string;
  personId: string | null;
  name: string;
  phone: string;
  note?: string;
  pin?: string;
};

export type RequestClaimResult = {
  claimId: string;
  code: string;
  contactWhatsapp: string | null;
};

export async function requestClaim(input: RequestClaimInput): Promise<RequestClaimResult> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter your name");
  if (!isValidPhone(input.phone)) throw new Error("Enter a valid WhatsApp number");
  const phone = normalizePhone(input.phone);

  const share = await db.sharedView.findUnique({
    where: { slug: input.slug },
    select: {
      treeId: true,
      revoked: true,
      expiresAt: true,
      allowClaims: true,
      tree: { select: { contactWhatsapp: true, claimPinHash: true } },
    },
  });
  if (!share || share.revoked) throw new Error("This link is no longer available");
  if (share.expiresAt && share.expiresAt.getTime() < Date.now())
    throw new Error("This link has expired");
  if (!share.allowClaims) throw new Error("This shared view does not accept claims");

  if (share.tree.claimPinHash) {
    if (!input.pin || !verifySharePassword(input.pin.trim(), share.tree.claimPinHash)) {
      throw new Error("Wrong family word");
    }
  }

  let surnameHint: string | null = null;
  if (input.personId) {
    const person = await db.person.findFirst({
      where: { id: input.personId, treeId: share.treeId },
      select: {
        id: true,
        living: true,
        claimedByUserId: true,
        names: { select: { surname: true, preferred: true, type: true, order: true } },
        eventRefs: { where: { event: { type: "Death" } }, select: { id: true } },
      },
    });
    if (!person) throw new Error("That person is not in this tree");
    if (person.claimedByUserId) throw new Error("Someone has already claimed this profile");
    if (person.eventRefs.length > 0) throw new Error("This person has a recorded death");
    surnameHint =
      person.names.find((n) => n.preferred)?.surname ?? person.names[0]?.surname ?? null;

    const dupe = await db.personClaim.findFirst({
      where: { personId: person.id, status: ClaimStatus.PENDING },
      select: { id: true },
    });
    if (dupe) throw new Error("There is already a pending claim for this profile");
  }

  const claim = await db.personClaim.create({
    data: {
      treeId: share.treeId,
      personId: input.personId,
      claimantName: name,
      phone,
      note: input.note?.trim() || null,
      code: claimCode(surnameHint),
      status: ClaimStatus.PENDING,
    },
    select: { id: true, code: true },
  });

  await logActivity({
    treeId: share.treeId,
    verb: "requested",
    objectType: "claim",
    objectId: claim.id,
    summary: `${name} asked to ${input.personId ? "claim a profile" : "join the tree"}`,
  });

  return { claimId: claim.id, code: claim.code, contactWhatsapp: share.tree.contactWhatsapp };
}

export type ApproveResult = { phone: string; name: string; signInUrl: string };

export async function approveClaim(
  treeId: string,
  claimId: string,
  actorId: string,
  role: Role = Role.CONTRIBUTOR,
): Promise<ApproveResult> {
  const claim = await db.personClaim.findFirst({
    where: { id: claimId, treeId },
    select: {
      id: true,
      status: true,
      personId: true,
      claimantName: true,
      phone: true,
      tree: { select: { workspaceId: true, name: true } },
    },
  });
  if (!claim) throw new Error("Claim not found");
  if (claim.status === ClaimStatus.APPROVED) {
    const existing = await db.personClaim.findUnique({
      where: { id: claimId },
      select: { signInToken: true, phone: true, claimantName: true },
    });
    return {
      phone: existing!.phone,
      name: existing!.claimantName,
      signInUrl: `${await publicOrigin()}/api/auth/wa/${existing!.signInToken}`,
    };
  }
  if (claim.status !== ClaimStatus.PENDING) throw new Error("This claim can't be approved");

  const synthEmail = `${claim.phone}@wa.local`;

  const result = await db.$transaction(async (tx) => {
    let user = await tx.user.findFirst({
      where: { OR: [{ phone: claim.phone }, { email: synthEmail }] },
      select: { id: true, claimedPerson: { select: { id: true } } },
    });

    if (user?.claimedPerson && user.claimedPerson.id !== claim.personId) {
      throw new Error("This WhatsApp number is already linked to another profile in a tree");
    }

    if (!user) {
      const created = await tx.user.create({
        data: { name: claim.claimantName, email: synthEmail, phone: claim.phone },
        select: { id: true },
      });
      user = { id: created.id, claimedPerson: null };
    }

    await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: claim.tree.workspaceId, userId: user.id } },
      update: {},
      create: { workspaceId: claim.tree.workspaceId, userId: user.id, role },
    });

    if (claim.personId) {
      const person = await tx.person.findUnique({
        where: { id: claim.personId },
        select: { claimedByUserId: true },
      });
      if (person?.claimedByUserId && person.claimedByUserId !== user.id) {
        throw new Error("That profile was claimed by someone else in the meantime");
      }
      await tx.person.update({
        where: { id: claim.personId },
        data: { claimedByUserId: user.id, phone: claim.phone },
      });
    }

    const signInToken = randomBytes(24).toString("hex");
    await tx.personClaim.update({
      where: { id: claim.id },
      data: {
        status: ClaimStatus.APPROVED,
        decidedById: actorId,
        decidedAt: new Date(),
        createdUserId: user.id,
        signInToken,
        signInTokenExpiresAt: new Date(Date.now() + SIGNIN_TOKEN_DAYS * 864e5),
        signInTokenUsedAt: null,
      },
    });

    return { userId: user.id, signInToken };
  });

  await ensurePersonalWorkspace(result.userId, claim.claimantName);

  await logActivity({
    treeId,
    actorId,
    verb: "approved",
    objectType: "claim",
    objectId: claim.id,
    summary: `approved ${claim.claimantName}'s claim`,
  });

  return {
    phone: claim.phone,
    name: claim.claimantName,
    signInUrl: `${await publicOrigin()}/api/auth/wa/${result.signInToken}`,
  };
}

export async function rejectClaim(
  treeId: string,
  claimId: string,
  actorId: string,
  reason?: string,
): Promise<void> {
  const claim = await db.personClaim.findFirst({
    where: { id: claimId, treeId },
    select: { id: true, status: true },
  });
  if (!claim) throw new Error("Claim not found");
  if (claim.status === ClaimStatus.APPROVED) throw new Error("Already approved");
  await db.personClaim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.REJECTED,
      decidedById: actorId,
      decidedAt: new Date(),
      rejectionReason: reason?.trim() || null,
    },
  });
}

/** True when a person has a recorded Death or Burial event. */
async function isDeceased(personId: string): Promise<boolean> {
  const n = await db.eventRef.count({
    where: { personId, event: { type: { in: ["Death", "Burial"] } } },
  });
  return n > 0;
}

/** Find or create the WhatsApp-identity user for a phone number. */
export async function resolveOrCreateWaUser(
  phoneRaw: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  if (!isValidPhone(phoneRaw)) throw new Error("Enter a valid WhatsApp number");
  const phone = normalizePhone(phoneRaw);
  const synthEmail = `${phone}@wa.local`;
  const existing = await db.user.findFirst({
    where: { OR: [{ phone }, { email: synthEmail }] },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const created = await db.user.create({
    data: { name: name.trim() || phone, email: synthEmail, phone },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

/**
 * Bind a person's profile directly to a user account — the manager / admin
 * shortcut that skips the invite → request → approve flow. Runs the same
 * provisioning tail as `approveClaim`: workspace membership, phone, and an
 * optional one-time WhatsApp sign-in link. Refuses deceased people and
 * double-claims.
 */
export async function linkPersonToUser(input: {
  treeId: string;
  personId: string;
  userId: string;
  role?: Role;
  actorId: string;
  issueSignIn?: boolean;
}): Promise<{ signInUrl: string | null; alreadyLinked: boolean }> {
  const role = input.role ?? Role.CONTRIBUTOR;

  const person = await db.person.findFirst({
    where: { id: input.personId, treeId: input.treeId },
    select: { id: true, phone: true, claimedByUserId: true },
  });
  if (!person) throw new Error("Person not found in this tree");
  if (person.claimedByUserId === input.userId) {
    return { signInUrl: null, alreadyLinked: true };
  }
  if (person.claimedByUserId) throw new Error("This profile is already claimed by someone else");
  if (await isDeceased(input.personId)) throw new Error("A deceased person's profile can't be claimed");

  const tree = await db.tree.findUniqueOrThrow({
    where: { id: input.treeId },
    select: { workspaceId: true, name: true },
  });
  const user = await db.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { id: true, name: true, phone: true, claimedPerson: { select: { id: true } } },
  });
  if (user.claimedPerson && user.claimedPerson.id !== input.personId) {
    throw new Error("That account already claims another profile");
  }

  let signInToken: string | null = null;
  await db.$transaction(async (tx) => {
    const fresh = await tx.person.findUnique({
      where: { id: input.personId },
      select: { claimedByUserId: true },
    });
    if (fresh?.claimedByUserId && fresh.claimedByUserId !== input.userId) {
      throw new Error("That profile was claimed by someone else in the meantime");
    }
    await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: tree.workspaceId, userId: user.id } },
      update: {},
      create: { workspaceId: tree.workspaceId, userId: user.id, role },
    });
    await tx.person.update({
      where: { id: input.personId },
      data: { claimedByUserId: user.id, phone: person.phone ?? user.phone ?? undefined },
    });
    if (input.issueSignIn && user.phone) {
      signInToken = randomBytes(24).toString("hex");
      await tx.personClaim.create({
        data: {
          treeId: input.treeId,
          personId: input.personId,
          claimantName: user.name ?? user.phone,
          phone: user.phone,
          code: claimCode(null),
          status: ClaimStatus.APPROVED,
          decidedById: input.actorId,
          decidedAt: new Date(),
          createdUserId: user.id,
          signInToken,
          signInTokenExpiresAt: new Date(Date.now() + SIGNIN_TOKEN_DAYS * 864e5),
        },
      });
    }
  });

  await ensurePersonalWorkspace(user.id, user.name ?? "My");
  await logActivity({
    treeId: input.treeId,
    actorId: input.actorId,
    verb: "linked",
    objectType: "claim",
    objectId: input.personId,
    summary: `linked a profile to ${user.name ?? user.phone ?? "an account"}`,
  });

  return {
    signInUrl: signInToken ? `${await publicOrigin()}/api/auth/wa/${signInToken}` : null,
    alreadyLinked: false,
  };
}

/**
 * Release any account claim on a person who has just been recorded as dead:
 * a deceased profile must never be a claimable account. The user account
 * itself is untouched.
 */
export async function releaseClaimOnDeath(personId: string): Promise<void> {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { id: true, treeId: true, claimedByUserId: true },
  });
  if (!person) return;

  await db.claimInvite.updateMany({
    where: { personId, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date() },
  });
  await db.personClaim.updateMany({
    where: { personId, status: ClaimStatus.PENDING },
    data: { status: ClaimStatus.REJECTED, rejectionReason: "Person recorded as deceased" },
  });

  if (person.claimedByUserId) {
    await db.person.update({ where: { id: personId }, data: { claimedByUserId: null } });
    await logActivity({
      treeId: person.treeId,
      verb: "updated",
      objectType: "claim",
      objectId: personId,
      summary: "released the profile claim — person recorded as deceased",
    });
  }
}

/** Validate a one-time WhatsApp sign-in token; returns the userId or null. */
export async function consumeSignInToken(token: string): Promise<string | null> {
  const claim = await db.personClaim.findUnique({
    where: { signInToken: token },
    select: {
      id: true,
      createdUserId: true,
      signInTokenExpiresAt: true,
      signInTokenUsedAt: true,
    },
  });
  if (!claim?.createdUserId) return null;
  if (claim.signInTokenUsedAt) return claim.createdUserId; // idempotent re-click within window
  if (claim.signInTokenExpiresAt && claim.signInTokenExpiresAt.getTime() < Date.now()) return null;

  await db.personClaim.update({
    where: { id: claim.id },
    data: { signInTokenUsedAt: new Date() },
  });
  return claim.createdUserId;
}

/** Convenience: text for the "confirm on WhatsApp" message a claimant sends. */
export function claimConfirmMessage(opts: {
  name: string;
  code: string;
  treeName: string;
  personName?: string | null;
}): string {
  const what = opts.personName
    ? `claiming my profile "${opts.personName}"`
    : `asking to join`;
  return `Family Compass — I'm ${opts.name}, ${what} on the "${opts.treeName}" tree. Code: ${opts.code}`;
}
