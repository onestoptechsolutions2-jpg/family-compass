"use server";

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { ensurePersonalWorkspace } from "@/lib/workspace";

export async function acceptInvite(token: string) {
  const user = await requireUser();

  const invite = await db.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      workspaceId: true,
    },
  });
  if (!invite) throw new Error("This invitation link is not valid.");
  if (invite.acceptedAt) throw new Error("This invitation has already been used.");
  if (invite.expiresAt.getTime() < Date.now()) throw new Error("This invitation has expired.");
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new Error(`This invitation was sent to ${invite.email}.`);
  }

  await ensurePersonalWorkspace(user.id, user.name ?? user.email ?? "My");

  await db.membership.upsert({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    update: { role: invite.role === Role.OWNER ? Role.OWNER : invite.role },
    create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
  });
  await db.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

  redirect("/app");
}
