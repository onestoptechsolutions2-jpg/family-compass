"use server";

import { revalidatePath } from "next/cache";
import { PartnerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { randomToken } from "@/lib/slug";
import { SKILLS } from "@/lib/jobs";

const csv = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
const skillsOf = (fd: FormData) => fd.getAll("skills").map(String).filter((k) => k in SKILLS);

/** Add a partner you already know and get a link to send them. */
export async function invitePartner(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name) throw new Error("Enter the partner's name");
  if (!email.includes("@")) throw new Error("Enter the email they will sign in with (their Google account)");
  const skills = skillsOf(formData);
  if (!skills.length) throw new Error("Choose at least one speciality");

  const partner = await db.partner.create({
    data: {
      name,
      email,
      phone: String(formData.get("phone") ?? "").trim().slice(0, 40) || null,
      regions: csv(formData.get("regions")),
      skills,
      status: PartnerStatus.ACTIVE,
    },
  });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  await db.partnerInvite.create({ data: { partnerId: partner.id, email, token: randomToken(24), expiresAt } });
  await writeAudit({ actorId: admin.id, action: "partner.invite", targetType: "partner", targetId: partner.id });
  revalidatePath("/admin/partners");
}

export async function setPartnerStatus(partnerId: string, status: PartnerStatus) {
  const admin = await requirePlatformAdmin();
  await db.partner.update({ where: { id: partnerId }, data: { status } });
  await writeAudit({ actorId: admin.id, action: "partner.status", targetType: "partner", targetId: partnerId, meta: { status } });
  revalidatePath("/admin/partners");
}

export async function updatePartner(partnerId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const skills = skillsOf(formData);
  if (!skills.length) throw new Error("A partner needs at least one speciality");
  await db.partner.update({
    where: { id: partnerId },
    data: { skills, regions: csv(formData.get("regions")), phone: String(formData.get("phone") ?? "").trim().slice(0, 40) || null },
  });
  await writeAudit({ actorId: admin.id, action: "partner.update", targetType: "partner", targetId: partnerId });
  revalidatePath("/admin/partners");
}
