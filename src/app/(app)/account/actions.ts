"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { hashPassword, verifyPassword, passwordProblem } from "@/lib/password";
import { setResearchConsent } from "@/lib/consent";
import { sessionCookieName } from "@/lib/session";

export async function toggleResearchConsent(formData: FormData) {
  const me = await requireUser();
  await setResearchConsent(me.id, formData.get("on") === "1");
  redirect("/account?ok=research");
}

export async function setMyPassword(formData: FormData) {
  const me = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { passwordHash: true },
  });

  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) {
    redirect("/account?error=current");
  }
  if (next !== confirm) redirect("/account?error=mismatch");
  const problem = passwordProblem(next);
  if (problem) redirect(`/account?error=${encodeURIComponent(problem)}`);

  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  redirect("/account?ok=1");
}

export async function removeMyPassword() {
  const me = await requireUser();
  await db.user.update({ where: { id: me.id }, data: { passwordHash: null } });
  redirect("/account?ok=removed");
}

/** Sign one device out. Revoking the current one logs you out here too. */
export async function revokeSession(sessionId: string) {
  const me = await requireUser();
  const jar = await cookies();
  const currentToken = jar.get(sessionCookieName())?.value ?? null;

  const row = await db.session.findFirst({
    where: { id: sessionId, userId: me.id },
    select: { id: true, sessionToken: true },
  });
  if (!row) redirect("/account?error=Session not found");

  await db.session.delete({ where: { id: row.id } });

  if (currentToken && row.sessionToken === currentToken) {
    jar.delete(sessionCookieName());
    redirect("/login");
  }
  redirect("/account?ok=device");
}

/** Sign out every other device. */
export async function revokeOtherSessions() {
  const me = await requireUser();
  const jar = await cookies();
  const currentToken = jar.get(sessionCookieName())?.value ?? null;
  await db.session.deleteMany({
    where: { userId: me.id, NOT: currentToken ? { sessionToken: currentToken } : undefined },
  });
  redirect("/account?ok=device");
}
