"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { ClaimStatus } from "@prisma/client";
import { isValidPhone, normalizePhone, claimCode } from "@/lib/wa";
import { logActivity } from "@/lib/activity";
import { notifyTreeManagers } from "@/lib/notify";

export async function submitClaimInvite(token: string, formData: FormData) {
  const invite = await db.claimInvite.findUnique({
    where: { token },
    select: {
      id: true,
      treeId: true,
      personId: true,
      revokedAt: true,
      usedAt: true,
      expiresAt: true,
      person: {
        select: {
          claimedByUserId: true,
          names: { select: { surname: true, preferred: true, type: true, order: true } },
          eventRefs: { where: { event: { type: { in: ["Death", "Burial"] } } }, select: { id: true } },
        },
      },
    },
  });
  if (!invite) redirect(`/claim/${token}?err=gone`);
  if (invite.revokedAt || invite.usedAt) redirect(`/claim/${token}?err=used`);
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) redirect(`/claim/${token}?err=expired`);
  if (invite.person.claimedByUserId) redirect(`/claim/${token}?err=claimed`);
  if (invite.person.eventRefs.length > 0) redirect(`/claim/${token}?err=deceased`);

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  if (name.length < 2) redirect(`/claim/${token}?err=name`);
  if (!isValidPhone(phoneRaw)) redirect(`/claim/${token}?err=phone`);
  const phone = normalizePhone(phoneRaw);

  const surname =
    invite.person.names.find((n) => n.preferred)?.surname ?? invite.person.names[0]?.surname ?? null;

  const existing = await db.personClaim.findFirst({
    where: { personId: invite.personId, status: ClaimStatus.PENDING },
    select: { id: true },
  });
  if (existing) redirect(`/claim/${token}?sent=1`);

  const claim = await db.personClaim.create({
    data: {
      treeId: invite.treeId,
      personId: invite.personId,
      claimantName: name,
      phone,
      note,
      code: claimCode(surname),
      status: ClaimStatus.PENDING,
    },
    select: { id: true },
  });
  await db.claimInvite.update({
    where: { id: invite.id },
    data: { claimId: claim.id, usedAt: new Date() },
  });

  await logActivity({
    treeId: invite.treeId,
    verb: "requested",
    objectType: "claim",
    objectId: claim.id,
    summary: `${name} claimed a profile via an invite link`,
  });
  await notifyTreeManagers(invite.treeId, {
    kind: "claim.requested",
    title: "Profile claim to review",
    body: `${name} says a profile is theirs (via a claim link).`,
    linkPath: `/trees/${invite.treeId}/claims`,
  });

  revalidatePath(`/claim/${token}`);
  redirect(`/claim/${token}?sent=1`);
}
