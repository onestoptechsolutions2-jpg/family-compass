"use server";

import { redirect } from "next/navigation";

import { requestClaim } from "@/lib/claims";

export async function submitClaim(slug: string, personId: string | null, formData: FormData) {
  const res = await requestClaim({
    slug,
    personId,
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
    pin: String(formData.get("pin") ?? "") || undefined,
  });
  redirect(`/s/${slug}/claim/sent?c=${res.claimId}`);
}
