"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { requireTreeManage } from "@/lib/rbac";
import { approveClaim, rejectClaim } from "@/lib/claims";

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
