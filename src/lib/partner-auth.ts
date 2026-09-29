import { redirect } from "next/navigation";
import { PartnerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/rbac";

/** The signed-in user and the partner they belong to, if any. */
export async function getPartnerContext() {
  const user = await requireUser();
  const member = await db.partnerMember.findUnique({
    where: { userId: user.id },
    include: { partner: true },
  });
  return { user, partner: member?.partner ?? null };
}

/** Only an approved partner gets past this; everyone else is sent to the portal home. */
export async function requireActivePartner() {
  const { user, partner } = await getPartnerContext();
  if (!partner || partner.status !== PartnerStatus.ACTIVE) redirect("/partner");
  return { user, partner };
}

/** For file routes: an admin, or a member of the given partner. */
export async function canSeePartnerFiles(partnerId: string | null): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  if (!partnerId) return false;
  const m = await db.partnerMember.findUnique({ where: { userId: user.id }, select: { partnerId: true } });
  return m?.partnerId === partnerId;
}
