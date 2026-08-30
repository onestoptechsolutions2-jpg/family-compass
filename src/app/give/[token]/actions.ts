"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { recordPledge } from "@/lib/chama";
import { clientIp } from "@/lib/user-agent";

export async function submitContribution(token: string, formData: FormData) {
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
  revalidatePath(`/give/${token}`);
  redirect(`/give/${token}?given=1`);
}
