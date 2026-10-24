"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { hitLimit } from "@/lib/api/rate-limit";
import { isReferrerKind, normalisePhone, uniqueCode } from "@/lib/referrals";

const fail = (msg: string) => redirect(`/refer?error=${encodeURIComponent(msg)}`);

/** Anyone signed in can become a referrer: a name, what they are, and the M-Pesa number to pay. */
export async function becomeReferrer(formData: FormData) {
  const user = await requireUser();
  if (!hitLimit(`refer-join:${user.id}`, 5, 3600)) fail("Too many attempts. Please try again later.");
  if (await db.referrer.findUnique({ where: { userId: user.id }, select: { id: true } })) redirect("/refer/dashboard");

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const kind = String(formData.get("kind") ?? "");
  const phone = normalisePhone(String(formData.get("payoutPhone") ?? ""));
  if (name.length < 2) fail("Tell us your name, or your organisation's.");
  if (!isReferrerKind(kind)) fail("Choose what best describes you.");
  if (!phone) fail("Enter the M-Pesa number to send your earnings to, e.g. 0712 345 678.");
  if (formData.get("agree") !== "on") fail("Please agree to the referral terms.");

  const code = await uniqueCode(name);
  const r = await db.referrer.create({ data: { userId: user.id, name, kind, payoutPhone: phone!, code }, select: { id: true } });
  await writeAudit({ actorId: user.id, action: "referrer.join", targetType: "referrer", targetId: r.id, meta: { kind, code } });
  redirect("/refer/dashboard?new=1");
}

/** A referrer changes the M-Pesa number their earnings go to. */
export async function updatePayoutPhone(formData: FormData) {
  const user = await requireUser();
  const phone = normalisePhone(String(formData.get("payoutPhone") ?? ""));
  if (!phone) redirect(`/refer/dashboard?error=${encodeURIComponent("That does not look like a Kenyan mobile number.")}`);
  await db.referrer.update({ where: { userId: user.id }, data: { payoutPhone: phone! } });
  redirect("/refer/dashboard?saved=1");
}
