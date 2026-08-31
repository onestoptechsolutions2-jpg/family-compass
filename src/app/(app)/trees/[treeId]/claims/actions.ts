"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";

import { requireTreeEdit, requireTreeManage } from "@/lib/rbac";
import { approveClaim, rejectClaim, issueClaimInvite } from "@/lib/claims";

/** Generate (or refresh) a claim link for a person from the account-claims report. */
export async function sendClaimLink(treeId: string, personId: string) {
  const ctx = await requireTreeEdit(treeId);
  try {
    await issueClaimInvite(treeId, personId, null, ctx.user.id);
  } catch (e) {
    redirect(
      `/trees/${treeId}/claims?claimErr=${encodeURIComponent(
        e instanceof Error ? e.message : "failed",
      )}#accounts`,
    );
  }
  revalidatePath(`/trees/${treeId}/claims`);
  redirect(`/trees/${treeId}/claims?claimOk=${personId}#accounts`);
}

export async function approveClaimAction(treeId: string, claimId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const role = z
    .enum([Role.VIEWER, Role.CONTRIBUTOR, Role.EDITOR])
    .default(Role.CONTRIBUTOR)
    .parse(formData.get("role") ?? undefined);
  await approveClaim(treeId, claimId, ctx.user.id, role);
  revalidatePath(`/trees/${treeId}/claims`);
}

export async function rejectClaimAction(treeId: string, claimId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  await rejectClaim(treeId, claimId, ctx.user.id, reason);
  revalidatePath(`/trees/${treeId}/claims`);
}
