"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { recordPledge } from "@/lib/chama";
import { clientIp } from "@/lib/user-agent";

export async function submitContribution(token: string, formData: FormData) {
  // light per-browser cap so a form can't be spammed
  const jar = await cookies();
  const key = `fc_give_${token}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60);
  const sent = Number(jar.get(key)?.value ?? "0");
  if (sent >= 10) redirect(`/give/${token}?err=cap`);

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const amountKes = Number(String(formData.get("amountKes") ?? "").replace(/[^\d]/g, ""));
  const rawMethod = String(formData.get("method") ?? "MPESA_MANUAL");
  const method =
    rawMethod === "CASH" ? "CASH" : rawMethod === "OTHER" ? "OTHER" : "MPESA_MANUAL";
  const mpesaCode = String(formData.get("mpesaCode") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const h = await headers();
  const res = await recordPledge(token, {
    name,
    phone,
    amountKes,
    method,
    mpesaCode,
    note,
    ip: clientIp(h.get("x-forwarded-for")) ?? h.get("x-real-ip") ?? null,
  });

  if (!res.ok) redirect(`/give/${token}?err=${res.error}`);
  jar.set(key, String(sent + 1), { httpOnly: true, sameSite: "lax", path: `/give/${token}`, maxAge: 86400 });
  revalidatePath(`/give/${token}`);
  redirect(`/give/${token}?given=1`);
}
