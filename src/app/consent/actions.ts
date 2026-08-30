"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { recordConsent } from "@/lib/consent";

export async function acceptPolicies(formData: FormData) {
  const me = await requireUser();
  if (formData.get("agree") !== "on" && formData.get("agree") !== "true") {
    redirect("/consent?error=agree");
  }
  const research = formData.get("research") === "on" || formData.get("research") === "true";
  const marketing = formData.get("marketing") === "on" || formData.get("marketing") === "true";
  await recordConsent(me.id, { research, marketing });
  const next = String(formData.get("next") ?? "/app");
  redirect(next.startsWith("/") ? next : "/app");
}
