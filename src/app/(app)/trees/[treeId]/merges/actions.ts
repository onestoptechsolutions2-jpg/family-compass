"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTreeManage } from "@/lib/rbac";
import { flashOk, flashErr } from "@/lib/flash";
import { ensureIdentityForPerson } from "@/lib/identity";
import {
  proposeIdentityMerge,
  approveIdentityMerge,
  rejectIdentityMerge,
  revertIdentityMerge,
} from "@/lib/identity-merge";
import { decideMarriageLink } from "@/lib/identity-relationships";

/** Propose that a Person in this tree and a Person elsewhere (pasted by id,
 *  from that profile's URL — there's no cross-tree picker yet) are the same
 *  human. See docs/identity-dedup-claim-workflow.md §3. */
export async function proposeMergeAction(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const duplicatePersonId = String(formData.get("duplicatePersonId") ?? "").trim();
  const correctPersonId = String(formData.get("correctPersonId") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim() || undefined;

  try {
    if (!duplicatePersonId || !correctPersonId) throw new Error("Pick both profiles");
    if (duplicatePersonId === correctPersonId) throw new Error("That's the same profile");

    const fromIdentityId = await ensureIdentityForPerson(duplicatePersonId);
    const intoIdentityId = await ensureIdentityForPerson(correctPersonId);
    await proposeIdentityMerge({ fromIdentityId, intoIdentityId, evidence, proposedById: ctx.user.id });
    await flashOk("Merge proposed — waiting on every affected family to sign off.");
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not propose that merge.");
  }
  revalidatePath(`/trees/${treeId}/merges`);
  redirect(`/trees/${treeId}/merges`);
}

export async function approveMergeAction(treeId: string, requestId: string) {
  const ctx = await requireTreeManage(treeId);
  try {
    const { executed } = await approveIdentityMerge(requestId, treeId, ctx.user.id);
    await flashOk(executed ? "All families approved — merge applied." : "Approved — waiting on other families.");
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not approve that merge.");
  }
  revalidatePath(`/trees/${treeId}/merges`);
}

export async function rejectMergeAction(treeId: string, requestId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  try {
    await rejectIdentityMerge(requestId, treeId, ctx.user.id, reason);
    await flashOk("Merge request rejected.");
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not reject that merge.");
  }
  revalidatePath(`/trees/${treeId}/merges`);
}

export async function decideMarriageLinkAction(
  treeId: string,
  relationshipId: string,
  decision: "confirm" | "dispute",
) {
  await requireTreeManage(treeId);
  try {
    await decideMarriageLink(relationshipId, treeId, decision);
    await flashOk(decision === "confirm" ? "Connected — the shared family view is live both ways." : "Disputed.");
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not update that connection.");
  }
  revalidatePath(`/trees/${treeId}/merges`);
}

export async function revertMergeAction(treeId: string, requestId: string) {
  const ctx = await requireTreeManage(treeId);
  try {
    await revertIdentityMerge(requestId, ctx.user.id);
    await flashOk("Merge undone — everything is back the way it was.");
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not undo that merge.");
  }
  revalidatePath(`/trees/${treeId}/merges`);
}
