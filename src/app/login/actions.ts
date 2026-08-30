"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { startDbSession } from "@/lib/session";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Email + password sign-in (super-admin / anyone who has set a password). */
export async function passwordSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/app") || "/app";

  const user = email
    ? await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } })
    : null;

  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!ok || !user) {
    await sleep(400); // slow brute force
    redirect("/login?error=BadCredentials");
  }

  await startDbSession(user.id);
  redirect(callbackUrl.startsWith("/") ? callbackUrl : "/app");
}
