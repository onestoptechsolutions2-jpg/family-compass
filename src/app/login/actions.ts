"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { startDbSession } from "@/lib/session";
import { homePathForUser } from "@/lib/home";
import { hitLimit } from "@/lib/api/rate-limit";
import { clientIpFromHeaders } from "@/lib/user-agent";
import { headers } from "next/headers";
import { safeNext } from "../join/safe-next";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Email + password sign-in (super-admin / anyone who has set a password). */
export async function passwordSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/app") || "/app";

  // This form is public now: slow down guessing, per address and per visitor.
  const ip = clientIpFromHeaders(await headers()) ?? "unknown";
  if (!hitLimit(`login:ip:${ip}`, 30, 900) || !hitLimit(`login:email:${email}`, 10, 900)) {
    await sleep(400);
    redirect("/login?error=BadCredentials");
  }

  const user = email
    ? await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } })
    : null;

  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!ok || !user) {
    await sleep(400); // slow brute force
    redirect("/login?error=BadCredentials");
  }

  await startDbSession(user.id);
  // No explicit target → land on the person's own home (their profile if a
  // claimed one exists), not a generic /app that just redirects again.
  const dest =
    callbackUrl !== "/app" && safeNext(callbackUrl) === callbackUrl
      ? callbackUrl
      : await homePathForUser(user.id);
  redirect(dest);
}
