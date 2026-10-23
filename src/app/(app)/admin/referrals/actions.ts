"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const back = (msg?: string) => redirect(`/admin/referrals${msg ? `?error=${encodeURIComponent(msg)}` : ""}`);

/**
 * Record that everything owed to a referrer has been sent by M-Pesa, under one confirmation code.
 * The money is sent from your own phone; this is the record of it.
 */
export async function markReferrerPaid(referrerId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const payoutRef = String(formData.get("payoutRef") ?? "").trim().toUpperCase().slice(0, 40);
  if (!/^[A-Z0-9]{6,20}$/.test(payoutRef)) back("Enter the M-Pesa confirmation code of the payout.");
  const owed = await db.referralCommission.findMany({ where: { referrerId, status: "PENDING" }, select: { id: true, amountKes: true } });
  if (!owed.length) back("Nothing is owed to that referrer.");
  const total = owed.reduce((n, c) => n + c.amountKes, 0);
  // only the rows read above, so a commission earned a moment ago is not swept in unpaid
  await db.referralCommission.updateMany({
    where: { id: { in: owed.map((c) => c.id) }, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), payoutRef, paidById: admin.id },
  });
  const r = await db.referrer.findUniqueOrThrow({ where: { id: referrerId }, select: { userId: true } });
  await notifyUser(r.userId, {
    kind: "referral.paid",
    title: "Your referral earnings were sent",
    body: `KES ${total.toLocaleString("en-KE")} was sent to your M-Pesa (${payoutRef}). Thank you for sending families to us.`,
    linkPath: "/refer/dashboard",
    email: true,
  });
  await writeAudit({ actorId: admin.id, action: "referral.payout", targetType: "referrer", targetId: referrerId, meta: { totalKes: total, payoutRef, count: owed.length } });
  revalidatePath("/admin/referrals");
}

/** Pause or resume a referrer, and set their own rate (blank uses the shop's). */
export async function updateReferrer(referrerId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const status = formData.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  const raw = String(formData.get("percent") ?? "").trim();
  const percent = raw === "" ? null : Number(raw);
  if (percent !== null && (!Number.isInteger(percent) || percent < 0 || percent > 50)) back("A referrer's rate is a whole number from 0 to 50, or blank for the shop's rate.");
  await db.referrer.update({ where: { id: referrerId }, data: { status, percent } });
  await writeAudit({ actorId: admin.id, action: "referrer.update", targetType: "referrer", targetId: referrerId, meta: { status, percent } });
  revalidatePath("/admin/referrals");
}
