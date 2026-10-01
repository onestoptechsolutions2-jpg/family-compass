"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { hitLimit } from "@/lib/api/rate-limit";
import { getSessionUser } from "@/lib/rbac";
import { sendVerifyEmail } from "@/lib/verify-email";
import { clientIpFromHeaders } from "@/lib/user-agent";

/** "Send it again", from the banner. */
export async function resendVerifyEmail() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ip = clientIpFromHeaders(await headers()) ?? "unknown";
  const ok = hitLimit(`verify:${user.id}`, 3, 3600) && hitLimit(`verify:ip:${ip}`, 10, 3600);
  if (ok) await sendVerifyEmail(user.id);
  redirect(`/shop?${ok ? "sent=1" : "slow=1"}`);
}
