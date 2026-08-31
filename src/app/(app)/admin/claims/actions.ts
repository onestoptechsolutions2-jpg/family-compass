"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { linkPersonToUser, resolveOrCreateWaUser } from "@/lib/claims";
import { writeAudit } from "@/lib/audit";
import { flashOk, flashErr } from "@/lib/flash";

const PATH = "/admin/claims";

/** flashErr then bounce back to the page — used for every guard failure. */
async function fail(message: string): Promise<never> {
  await flashErr(message);
  redirect(PATH);
}

const role = (raw: string): Role =>
  (Object.values(Role) as string[]).includes(raw) ? (raw as Role) : Role.CONTRIBUTOR;

async function personTree(personId: string): Promise<string> {
  const p = await db.person.findUnique({ where: { id: personId }, select: { treeId: true } });
  if (!p) return fail("No person with that id.");
  return p.treeId;
}

/** Link a profile to an existing account by email. */
export async function adminLinkByEmail(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const personId = String(formData.get("personId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!personId || !email) return fail("Person id and email are both required.");

  const user = await db.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) return fail("No account with that email.");

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
    return fail(e instanceof Error ? e.message : "Link failed.");
  }
  await writeAudit({ actorId: admin.id, action: "claim.admin_link_email", targetType: "claim", targetId: personId, meta: { email } });
  await flashOk("Profile linked.");
  revalidatePath(PATH);
  redirect(PATH);
}

/** Link a profile to a WhatsApp identity by phone (creating the account if
 *  needed) and mint a one-time sign-in link. */
export async function adminLinkByPhone(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const personId = String(formData.get("personId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!personId || !phone) return fail("Person id and phone are both required.");

  const treeId = await personTree(personId);
  let signInUrl: string | null = null;
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
    signInUrl = res.signInUrl ?? null;
    await writeAudit({
      actorId: admin.id,
      action: "claim.admin_link_phone",
      targetType: "claim",
      targetId: personId,
      meta: { phone, createdUser: u.created },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Link failed.");
  }
  await flashOk("Profile linked — send them the sign-in link below.");
  revalidatePath(PATH);
  redirect(signInUrl ? `${PATH}?signin=${encodeURIComponent(signInUrl)}` : PATH);
}

export async function adminUnlink(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const personId = String(formData.get("personId") ?? "").trim();
  if (!personId) redirect(PATH);
  await db.person.updateMany({ where: { id: personId }, data: { claimedByUserId: null } });
  await writeAudit({ actorId: admin.id, action: "claim.admin_unlink", targetType: "claim", targetId: personId });
  await flashOk("Profile unlinked.");
  revalidatePath(PATH);
  redirect(PATH);
}
