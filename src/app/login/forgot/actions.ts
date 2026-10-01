"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { hasEmailProvider } from "@/lib/env";
import { sendBranded } from "@/lib/email";
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
      await sendBranded(email, "Your Family Compass sign-in link", {
        heading: "Sign in to Family Compass",
        paragraphs: [`Hello${user.name ? ` ${user.name.split(" ")[0]}` : ""},`, "Use this link to sign in. It works once, for 24 hours. Then open Account to choose a new password."],
        button: { label: "Sign in", url: link },
        footnote: "If you did not ask for this, ignore this email. Nobody can sign in without it.",
      });
    }
  }
  redirect("/login/forgot?sent=1");
}
