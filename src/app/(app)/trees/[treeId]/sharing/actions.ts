"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role, ShareMode } from "@prisma/client";

import { db } from "@/lib/db";
import { loadTreeContext, requireTreeManage, canManageWorkspace } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { QUEUE, enqueue } from "@/lib/queue";
import { randomToken } from "@/lib/slug";
import { hashSharePassword } from "@/lib/share";
import { normalizePhone } from "@/lib/wa";
import { logActivity } from "@/lib/activity";

// ---------------- members & invitations ----------------

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(Role).default(Role.VIEWER),
});

export async function inviteMember(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const { email, role } = inviteSchema.parse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (role === Role.OWNER && !canManageWorkspace(ctx.role)) {
    throw new Error("Only the workspace owner can invite another owner");
  }
  const normalized = email.toLowerCase();

  const existing = await db.membership.findFirst({
    where: { workspaceId: ctx.workspace.id, user: { email: normalized } },
    select: { id: true },
  });
  if (existing) throw new Error("That person is already a member");

  const token = randomToken(24);
  await db.invitation.upsert({
    where: { workspaceId_email: { workspaceId: ctx.workspace.id, email: normalized } },
    update: { role, token, expiresAt: new Date(Date.now() + 14 * 864e5), acceptedAt: null },
    create: {
      workspaceId: ctx.workspace.id,
      email: normalized,
      role,
      token,
      invitedById: ctx.user.id,
      expiresAt: new Date(Date.now() + 14 * 864e5),
    },
  });

  const link = `${await publicOrigin()}/invite/${token}`;
  await enqueue(QUEUE.sendEmail, {
    to: normalized,
    subject: `You're invited to the "${ctx.tree.name}" family tree`,
    text: `${ctx.user.name ?? ctx.user.email} invited you to collaborate on the "${ctx.tree.name}" family tree on Family Compass as ${role.toLowerCase()}.\n\nAccept: ${link}\n\nThis link expires in 14 days.`,
    html: `<p><strong>${ctx.user.name ?? ctx.user.email}</strong> invited you to collaborate on the <strong>${ctx.tree.name}</strong> family tree on Family Compass as <strong>${role.toLowerCase()}</strong>.</p><p><a href="${link}">Accept the invitation</a> (expires in 14 days).</p>`,
  });

  revalidatePath(`/trees/${treeId}/sharing`);
}

export async function revokeInvite(treeId: string, invitationId: string) {
  const ctx = await requireTreeManage(treeId);
  const inv = await db.invitation.findFirst({
    where: { id: invitationId, workspaceId: ctx.workspace.id },
    select: { id: true },
  });
  if (!inv) throw new Error("Invitation not found");
  await db.invitation.delete({ where: { id: invitationId } });
  revalidatePath(`/trees/${treeId}/sharing`);
}

export async function changeMemberRole(treeId: string, membershipId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const role = z.enum(Role).parse(formData.get("role"));
  const membership = await db.membership.findFirst({
    where: { id: membershipId, workspaceId: ctx.workspace.id },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) throw new Error("Member not found");
  if ((membership.role === Role.OWNER || role === Role.OWNER) && !canManageWorkspace(ctx.role)) {
    throw new Error("Only an owner can change owner roles");
  }
  if (membership.userId === ctx.user.id && membership.role === Role.OWNER) {
    const owners = await db.membership.count({
      where: { workspaceId: ctx.workspace.id, role: Role.OWNER },
    });
    if (owners <= 1) throw new Error("A workspace needs at least one owner");
  }
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath(`/trees/${treeId}/sharing`);
}

export async function removeMember(treeId: string, membershipId: string) {
  const ctx = await loadTreeContext(treeId);
  if (!canManageWorkspace(ctx.role)) throw new Error("Only an owner can remove members");
  const membership = await db.membership.findFirst({
    where: { id: membershipId, workspaceId: ctx.workspace.id },
    select: { id: true, role: true },
  });
  if (!membership) throw new Error("Member not found");
  if (membership.role === Role.OWNER) {
    const owners = await db.membership.count({
      where: { workspaceId: ctx.workspace.id, role: Role.OWNER },
    });
    if (owners <= 1) throw new Error("Cannot remove the last owner");
  }
  await db.membership.delete({ where: { id: membershipId } });
  revalidatePath(`/trees/${treeId}/sharing`);
}

// ---------------- shared views ----------------

const shareSchema = z.object({
  centralPersonId: z.string().min(1, "Choose a central person"),
  title: z.string().trim().max(120).optional(),
  mode: z.enum(ShareMode).default(ShareMode.HOURGLASS),
  generations: z.coerce.number().int().min(2).max(6).default(4),
  includeLiving: z.coerce.boolean().default(false),
  allowClaims: z.coerce.boolean().default(false),
  password: z.string().trim().max(100).optional(),
  expiresInDays: z.coerce.number().int().min(0).max(3650).default(0),
});

export async function createSharedView(treeId: string, formData: FormData) {
  const ctx = await requireTreeManage(treeId);
  const d = shareSchema.parse(Object.fromEntries(formData));

  const person = await db.person.findFirst({
    where: { id: d.centralPersonId, treeId },
    select: { id: true },
  });
  if (!person) throw new Error("Central person is not in this tree");

  const view = await db.sharedView.create({
    data: {
      treeId,
      createdById: ctx.user.id,
      slug: randomToken(11),
      title: d.title || null,
      centralPersonId: d.centralPersonId,
      mode: d.mode,
      generations: d.generations,
      includeLiving: d.includeLiving,
      allowClaims: d.allowClaims,
      passwordHash: d.password ? hashSharePassword(d.password) : null,
      expiresAt: d.expiresInDays ? new Date(Date.now() + d.expiresInDays * 864e5) : null,
    },
    select: { id: true, slug: true },
  });

  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "shared",
    objectType: "sharedView",
    objectId: view.id,
    summary: `Published a shared view (${d.mode.toLowerCase()})`,
  });

  revalidatePath(`/trees/${treeId}/sharing`);
}

export async function revokeSharedView(treeId: string, id: string) {
  await requireTreeManage(treeId);
  const view = await db.sharedView.findFirst({ where: { id, treeId }, select: { id: true } });
  if (!view) throw new Error("Shared view not found");
  await db.sharedView.update({ where: { id }, data: { revoked: true } });
  revalidatePath(`/trees/${treeId}/sharing`);
}

export async function deleteSharedView(treeId: string, id: string) {
  await requireTreeManage(treeId);
  const view = await db.sharedView.findFirst({ where: { id, treeId }, select: { id: true } });
  if (!view) throw new Error("Shared view not found");
  await db.sharedView.delete({ where: { id } });
  revalidatePath(`/trees/${treeId}/sharing`);
}

export async function toggleSharedViewClaims(treeId: string, id: string, formData: FormData) {
  await requireTreeManage(treeId);
  const on = String(formData.get("on") ?? "") === "1";
  const view = await db.sharedView.findFirst({ where: { id, treeId }, select: { id: true } });
  if (!view) throw new Error("Shared view not found");
  await db.sharedView.update({ where: { id }, data: { allowClaims: on } });
  revalidatePath(`/trees/${treeId}/sharing`);
}

// ---------------- claim settings (per tree) ----------------

const claimSettingsSchema = z.object({
  contactWhatsapp: z.string().trim().max(30).optional(),
  familyWord: z.string().trim().max(60).optional(),
  clearFamilyWord: z.coerce.boolean().default(false),
});

export async function updateClaimSettings(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);
  const d = claimSettingsSchema.parse(Object.fromEntries(formData));
  const contactWhatsapp = d.contactWhatsapp ? normalizePhone(d.contactWhatsapp) : null;

  const data: { contactWhatsapp: string | null; claimPinHash?: string | null } = {
    contactWhatsapp,
  };
  if (d.clearFamilyWord) data.claimPinHash = null;
  else if (d.familyWord) data.claimPinHash = hashSharePassword(d.familyWord);

  await db.tree.update({ where: { id: treeId }, data });
  revalidatePath(`/trees/${treeId}/sharing`);
}
