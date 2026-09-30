"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { hasEmailProvider } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { hitLimit } from "@/lib/api/rate-limit";
import { mintLoginLink } from "@/lib/login-token";
import { clientIpFromHeaders } from "@/lib/user-agent";

/** Email a one-time sign-in link. Always answers the same, so it never reveals who has an account. */
export async function sendResetLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const ip = clientIpFromHeaders(await headers()) ?? "unknown";
  if (hasEmailProvider && email && hitLimit(`forgot:ip:${ip}`, 10, 3600) && hitLimit(`forgot:email:${email}`, 3, 3600)) {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
    if (user) {
      const link = await mintLoginLink(user.id, { days: 1, purpose: "reset" });
      await sendEmail({
        to: email,
        subject: "Your Family Compass sign-in link",
        text: `Hello ${user.name ?? ""},\n\nUse this link to sign in (it works once, for 24 hours):\n${link}\n\nThen open Account to choose a new password. If you did not ask for this, ignore this email.\n\nFamily Compass`,
      });
    }
  }
  redirect("/login/forgot?sent=1");
}
