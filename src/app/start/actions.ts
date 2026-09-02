"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Gender } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/rbac";
import { startDbSession } from "@/lib/session";
import { isValidPhone, normalizePhone } from "@/lib/wa";
import { requestIdentityClaim, provisionSelfTree } from "@/lib/identity";

const COOKIE = "fc_start";

const schema = z.object({
  first: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  birthYear: z.coerce.number().int().min(1850).max(new Date().getFullYear()).optional(),
  community: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(30),
});
export type StartDraft = z.infer<typeof schema>;

export async function readStartDraft(): Promise<StartDraft | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function startCheck(formData: FormData) {
  if (!env.SELF_START) redirect("/login");
  if (await getSessionUser()) redirect("/app");

  const d = schema.parse({
    first: formData.get("first"),
    surname: formData.get("surname"),
    gender: formData.get("gender") ?? "UNKNOWN",
    birthYear: formData.get("birthYear") || undefined,
    community: formData.get("community") ?? "",
    region: formData.get("region") ?? "",
    phone: formData.get("phone"),
  });
  if (!isValidPhone(d.phone)) redirect("/start?err=phone");

  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify({ ...d, phone: normalizePhone(d.phone) }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/start",
    maxAge: 900,
  });
  redirect("/start?step=review");
}

/**
 * Reached only after the mandatory identity search on step=review has shown
 * its candidates (if any) and the user explicitly clicked "none of these are
 * me" — see docs/onboarding-state-machine.md (NEW_IDENTITY_CREATED is never
 * a silent default). Mints a brand-new Identity for the self-Person.
 */
export async function startCreate() {
  if (!env.SELF_START) redirect("/login");
  if (await getSessionUser()) redirect("/app");

  const d = await readStartDraft();
  if (!d) redirect("/start");
  const phone = normalizePhone(d.phone);
  const synthEmail = `${phone}@wa.local`;
  const name = `${d.first} ${d.surname}`.trim();

  // find or create the user (WhatsApp-number identity, no email/password)
  let user = await db.user.findFirst({
    where: { OR: [{ phone }, { email: synthEmail }] },
    select: { id: true, memberships: { where: { role: "OWNER" }, select: { id: true }, take: 1 } },
  });

  if (user && user.memberships.length > 0) {
    // already has a workspace — just sign them in
    await startDbSession(user.id);
    (await cookies()).delete(COOKIE);
    redirect("/app");
  }

  if (!user) {
    const created = await db.user.create({
      data: { name, email: synthEmail, phone },
      select: { id: true },
    });
    user = { id: created.id, memberships: [] };
  }

  const { treeId, personId } = await provisionSelfTree(user.id, name, {
    first: d.first,
    surname: d.surname,
    gender: Gender[d.gender],
    birthYear: d.birthYear,
    community: d.community,
    region: d.region,
    phone,
  });

  await startDbSession(user.id);
  (await cookies()).delete(COOKIE);
  redirect(`/trees/${treeId}/people/${personId}`);
}

/**
 * File a self-claim against a candidate surfaced by the mandatory identity
 * search — "this is me" on an existing, unclaimed Identity rather than
 * creating a duplicate. Verified out of band (WhatsApp code, tree-admin
 * approval), same as any other PersonClaim. See
 * docs/identity-dedup-claim-workflow.md.
 */
export async function startClaimIdentity(formData: FormData) {
  if (!env.SELF_START) redirect("/login");
  if (await getSessionUser()) redirect("/app");

  const d = await readStartDraft();
  if (!d) redirect("/start");
  const personId = String(formData.get("personId") ?? "").trim();
  if (!personId) redirect("/start?step=review");

  const name = `${d.first} ${d.surname}`.trim();
  let claimId: string;
  try {
    const res = await requestIdentityClaim({
      candidatePersonId: personId,
      claimantName: name,
      phone: d.phone,
    });
    claimId = res.claimId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not file that claim";
    redirect(`/start?step=review&err=${encodeURIComponent(msg)}`);
  }

  redirect(`/start/claimed?c=${claimId}`);
}
