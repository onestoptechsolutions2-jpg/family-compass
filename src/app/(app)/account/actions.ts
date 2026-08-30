"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { hashPassword, verifyPassword, passwordProblem } from "@/lib/password";

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
