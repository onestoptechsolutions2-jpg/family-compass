"use server";

import { redirect } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/rbac";
import { renderEmail } from "@/lib/email-template";
import { sendEmailChecked } from "@/lib/email";
import { publicOrigin } from "@/lib/origin";

/** Send a real message to the admin's own address, and say plainly whether it went. */
export async function sendTestEmail() {
  const admin = await requirePlatformAdmin();
  const { text, html } = renderEmail({
    heading: "Email is working",
    paragraphs: ["This is a test from your Family Compass shop. If you can read it, customers will get their receipts, order updates and password links."],
    button: { label: "Open the shop", url: `${await publicOrigin()}/shop` },
  });
  const r = await sendEmailChecked({ to: admin.email, subject: "Family Compass test email", text, html });
  redirect(`/admin/launch?test=${r.ok ? "ok" : encodeURIComponent(r.error ?? "failed")}`);
}
