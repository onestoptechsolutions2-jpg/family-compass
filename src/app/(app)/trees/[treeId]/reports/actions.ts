"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTreeEdit } from "@/lib/rbac";
import { issueClaimInvite } from "@/lib/claims";

/** Generate (or refresh) a claim link for a person from the claim report. */
export async function sendClaimLink(treeId: string, personId: string) {
  const ctx = await requireTreeEdit(treeId);
  try {
    await issueClaimInvite(treeId, personId, null, ctx.user.id);
  } catch (e) {
    redirect(
      `/trees/${treeId}/reports?claimErr=${encodeURIComponent(
        e instanceof Error ? e.message : "failed",
      )}#claims`,
    );
  }
  revalidatePath(`/trees/${treeId}/reports`);
  redirect(`/trees/${treeId}/reports?claimOk=${personId}#claims`);
}
