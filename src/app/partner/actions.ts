"use server";

import { redirect } from "next/navigation";
import { PartnerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { requireActivePartner } from "@/lib/partner-auth";
import { notifyPlatformAdmins } from "@/lib/notify";
import { SKILLS, JobError, shipJob, startProduction, submitProof, submitQuote } from "@/lib/jobs";

const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
const csv = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);

async function fileOf(fd: FormData, k: string) {
  const f = fd.get(k);
  if (!(f instanceof File) || f.size === 0) return null;
  return { fileName: f.name || "photo.jpg", mimeType: f.type || "application/octet-stream", bytes: Buffer.from(await f.arrayBuffer()) };
}

/** Turn a rule we enforce into a message on the same page instead of an error screen. */
async function guarded(jobId: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof JobError) redirect(`/partner/jobs/${jobId}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/partner/jobs/${jobId}`);
}

export async function acceptPartnerInvite(token: string) {
  const user = await requireUser();
  const invite = await db.partnerInvite.findUnique({ where: { token }, include: { partner: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    redirect(`/partner/join/${token}?error=This invite link is not valid or has expired`);
  }
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    redirect(`/partner/join/${token}?error=${encodeURIComponent(`This invite was sent to ${invite.email}. Sign in with that Google account.`)}`);
  }
  const already = await db.partnerMember.findUnique({ where: { userId: user.id } });
  if (already && already.partnerId !== invite.partnerId) {
    redirect(`/partner/join/${token}?error=This account already belongs to another partner`);
  }
  await db.partnerMember.upsert({
    where: { userId: user.id },
    update: {},
    create: { partnerId: invite.partnerId, userId: user.id },
  });
  await db.partnerInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  redirect("/partner");
}

export async function applyAsPartner(formData: FormData) {
  const user = await requireUser();
  const existing = await db.partnerMember.findUnique({ where: { userId: user.id } });
  if (existing) redirect("/partner");
  const name = text(formData, "name", 120);
  const skills = formData.getAll("skills").map(String).filter((k) => k in SKILLS);
  if (!name || !skills.length) redirect("/partner/apply?error=Enter your business name and at least one speciality");

  const partner = await db.partner.create({
    data: {
      name,
      email: user.email,
      phone: text(formData, "phone", 40) || null,
      regions: csv(text(formData, "regions", 300)),
      skills,
      notes: text(formData, "notes", 600) || null,
      status: PartnerStatus.APPLIED,
      members: { create: { userId: user.id } },
    },
  });
  await notifyPlatformAdmins({ kind: "partner.applied", title: "Partner application", body: partner.name, linkPath: "/admin/partners" });
  redirect("/partner");
}

export async function quoteAction(jobId: string, formData: FormData) {
  const { partner } = await requireActivePartner();
  await guarded(jobId, () =>
    submitQuote(partner.id, jobId, {
      costKes: Number(formData.get("costKes")),
      leadDays: Number(formData.get("leadDays")),
      note: text(formData, "note", 300),
    }),
  );
}

export async function startAction(jobId: string) {
  const { partner } = await requireActivePartner();
  await guarded(jobId, () => startProduction(partner.id, jobId));
}

export async function proofAction(jobId: string, formData: FormData) {
  const { partner, user } = await requireActivePartner();
  await guarded(jobId, async () => {
    const file = await fileOf(formData, "photo");
    if (!file) throw new JobError("Choose a photo of the finished piece");
    await submitProof(partner.id, jobId, file, user.id);
  });
}

export async function shipAction(jobId: string, formData: FormData) {
  const { partner, user } = await requireActivePartner();
  await guarded(jobId, async () => {
    const proof = (await fileOf(formData, "receipt")) ?? undefined;
    await shipJob(partner.id, jobId, { trackingNote: text(formData, "trackingNote", 300), proof }, user.id);
  });
}
