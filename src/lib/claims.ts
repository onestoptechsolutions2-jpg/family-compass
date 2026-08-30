import { randomBytes } from "node:crypto";
import { ClaimStatus, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhone, isValidPhone, claimCode } from "@/lib/wa";
import { verifySharePassword } from "@/lib/share";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

const SIGNIN_TOKEN_DAYS = 14;

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
      signInUrl: `${env.APP_URL}/api/auth/wa/${existing!.signInToken}`,
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
    signInUrl: `${env.APP_URL}/api/auth/wa/${result.signInToken}`,
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
