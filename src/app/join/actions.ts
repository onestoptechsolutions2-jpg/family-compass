"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { env, isAdminEmail } from "@/lib/env";
import { hitLimit } from "@/lib/api/rate-limit";
import { hashPassword, passwordProblem } from "@/lib/password";
import { startDbSession } from "@/lib/session";
import { clientIpFromHeaders } from "@/lib/user-agent";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { safeNext } from "./safe-next";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A shopper creates their own account with an email and a password. */
export async function createAccount(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? "/shop"));
  const back = (err: string): never => redirect(`/join?error=${err}&next=${encodeURIComponent(next)}`);
  if (!env.SHOP_SIGNUP) back("closed");

  const ip = clientIpFromHeaders(await headers()) ?? "unknown";
  if (!hitLimit(`join:${ip}`, 8, 3600)) back("slow");

  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "");
  if (!name) back("name");
  if (!EMAIL.test(email)) back("email");
  if (passwordProblem(password)) back("password");

  // Never take over an account that already exists: they sign in (or reset) instead.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) back("exists");

  const user = await db.user.create({
    data: { email, name, passwordHash: await hashPassword(password), isPlatformAdmin: isAdminEmail(email) },
  });
  await ensurePersonalWorkspace(user.id, name);
  await startDbSession(user.id);
  redirect(next);
}
