"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { hashPassword, verifyPassword, passwordProblem } from "@/lib/password";
import { setResearchConsent } from "@/lib/consent";
import { sessionCookieName } from "@/lib/session";
import { flashOk, flashErr } from "@/lib/flash";
import { NOTIFY_GROUPS } from "@/lib/push";

export async function setNotifyPrefs(formData: FormData) {
  const me = await requireUser();
  const push = formData.get("push") === "on";
  const muted = NOTIFY_GROUPS.filter((g) => formData.get(`mute_${g.key}`) === "on").map((g) => g.key);
  await db.user.update({ where: { id: me.id }, data: { notifyPrefs: { push, muted } } });
  await flashOk("Notification settings saved.");
  redirect("/account");
}

export async function toggleResearchConsent(formData: FormData) {
  const me = await requireUser();
  const on = formData.get("on") === "1";
  await setResearchConsent(me.id, on);
  await flashOk(on ? "Research consent on." : "Research consent off.");
  redirect("/account");
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
    await flashErr("Your current password is wrong.");
    redirect("/account");
  }
  if (next !== confirm) {
    await flashErr("The new passwords don't match.");
    redirect("/account");
  }
  const problem = passwordProblem(next);
  if (problem) {
    await flashErr(problem);
    redirect("/account");
  }

  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  await flashOk("Password updated.");
  redirect("/account");
}

export async function removeMyPassword() {
  const me = await requireUser();
  await db.user.update({ where: { id: me.id }, data: { passwordHash: null } });
  await flashOk("Password sign-in removed.");
  redirect("/account");
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
  if (!row) {
    await flashErr("That session was not found.");
    redirect("/account");
  }

  await db.session.delete({ where: { id: row!.id } });

  if (currentToken && row!.sessionToken === currentToken) {
    jar.delete(sessionCookieName());
    redirect("/login");
  }
  await flashOk("Device signed out.");
  redirect("/account");
}

/** Sign out every other device. */
export async function revokeOtherSessions() {
  const me = await requireUser();
  const jar = await cookies();
  const currentToken = jar.get(sessionCookieName())?.value ?? null;
  await db.session.deleteMany({
    where: { userId: me.id, NOT: currentToken ? { sessionToken: currentToken } : undefined },
  });
  await flashOk("Signed out everywhere else.");
  redirect("/account");
}
