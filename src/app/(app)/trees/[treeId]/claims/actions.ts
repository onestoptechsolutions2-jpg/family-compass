"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";

import { requireTreeEdit, requireTreeManage } from "@/lib/rbac";
import { flashOk, flashErr } from "@/lib/flash";
import { db } from "@/lib/db";
import { approveClaim, rejectClaim, issueClaimInvite } from "@/lib/claims";
import { approveIdentityClaim } from "@/lib/identity";

/** Generate (or refresh) a claim link for a person from the account-claims report. */
export async function sendClaimLink(treeId: string, personId: string) {
  const ctx = await requireTreeEdit(treeId);
  try {
    await issueClaimInvite(treeId, personId, null, ctx.user.id);
    await flashOk("Claim link ready — copy or send it below.");
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not create a claim link.");
  }
  revalidatePath(`/trees/${treeId}/claims`);
  redirect(`/trees/${treeId}/claims#accounts`);
}

export async function approveClaimAction(treeId: string, claimId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);

  const claim = await db.personClaim.findFirst({
    where: { id: claimId, treeId },
    select: { personId: true, targetIdentityId: true },
  });

  if (claim?.targetIdentityId && !claim.personId) {
    // Identity-layer claim ("this is me, elsewhere in the graph") — never
    // grants Membership on this tree. See lib/identity.ts.
    await approveIdentityClaim(treeId, claimId, ctx.user.id);
    await flashOk("Identity claim approved — send them the sign-in link.");
  } else {
    const role = z
      .enum([Role.VIEWER, Role.CONTRIBUTOR, Role.EDITOR])
      .default(Role.CONTRIBUTOR)
      .parse(formData.get("role") ?? undefined);
    await approveClaim(treeId, claimId, ctx.user.id, role);
    await flashOk("Claim approved — send them the sign-in link.");
  }
  revalidatePath(`/trees/${treeId}/claims`);
}

export async function rejectClaimAction(treeId: string, claimId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  await rejectClaim(treeId, claimId, ctx.user.id, reason);
  await flashOk("Claim rejected.");
  revalidatePath(`/trees/${treeId}/claims`);
}
