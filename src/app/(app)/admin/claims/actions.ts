"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { linkPersonToUser, resolveOrCreateWaUser } from "@/lib/claims";
import { writeAudit } from "@/lib/audit";

const PATH = "/admin/claims";

async function personTree(personId: string) {
  const p = await db.person.findUnique({ where: { id: personId }, select: { treeId: true } });
  if (!p) redirect(`${PATH}?err=noperson`);
  return p.treeId;
}

const role = (raw: string): Role =>
  (Object.values(Role) as string[]).includes(raw) ? (raw as Role) : Role.CONTRIBUTOR;

/** Link a profile to an existing account by email. */
export async function adminLinkByEmail(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const personId = String(formData.get("personId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!personId || !email) redirect(`${PATH}?err=missing`);

  const user = await db.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) redirect(`${PATH}?err=nouser`);

  const treeId = await personTree(personId);
  try {
    await linkPersonToUser({
      treeId,
      personId,
      userId: user.id,
      role: role(String(formData.get("role") ?? "")),
      actorId: admin.id,
    });
  } catch (e) {
    redirect(`${PATH}?err=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
  await writeAudit({ actorId: admin.id, action: "claim.admin_link_email", targetType: "claim", targetId: personId, meta: { email } });
  revalidatePath(PATH);
  redirect(`${PATH}?ok=linked`);
}

/** Link a profile to a WhatsApp identity by phone (creating the account if
 *  needed) and mint a one-time sign-in link. */
export async function adminLinkByPhone(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const personId = String(formData.get("personId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!personId || !phone) redirect(`${PATH}?err=missing`);

  const treeId = await personTree(personId);
  try {
    const u = await resolveOrCreateWaUser(phone, name);
    const res = await linkPersonToUser({
      treeId,
      personId,
      userId: u.id,
      role: role(String(formData.get("role") ?? "")),
      actorId: admin.id,
      issueSignIn: true,
    });
    await writeAudit({
      actorId: admin.id,
      action: "claim.admin_link_phone",
      targetType: "claim",
      targetId: personId,
      meta: { phone, createdUser: u.created },
    });
    revalidatePath(PATH);
    redirect(`${PATH}?ok=linked${res.signInUrl ? `&signin=${encodeURIComponent(res.signInUrl)}` : ""}`);
  } catch (e) {
    redirect(`${PATH}?err=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
}

export async function adminUnlink(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const personId = String(formData.get("personId") ?? "").trim();
  if (!personId) redirect(PATH);
  await db.person.updateMany({ where: { id: personId }, data: { claimedByUserId: null } });
  await writeAudit({ actorId: admin.id, action: "claim.admin_unlink", targetType: "claim", targetId: personId });
  revalidatePath(PATH);
  redirect(`${PATH}?ok=unlinked`);
}
