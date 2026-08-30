import { headers } from "next/headers";

import { db } from "@/lib/db";
import { POLICY_VERSION, CONSENT_KIND } from "@/lib/policy";

export function consentIsStale(consentVersion: string | null | undefined): boolean {
  return consentVersion !== POLICY_VERSION;
}

export async function userConsentState(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { consentVersion: true, consentAt: true, researchConsent: true, marketingConsent: true },
  });
  return {
    ...u,
    stale: consentIsStale(u?.consentVersion),
  };
}

async function reqMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent") ?? null,
  };
}

/** Record acceptance of the current policies + research/marketing choices. */
export async function recordConsent(
  userId: string,
  opts: { research: boolean; marketing: boolean },
): Promise<void> {
  const meta = await reqMeta();
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        consentVersion: POLICY_VERSION,
        consentAt: new Date(),
        researchConsent: opts.research,
        marketingConsent: opts.marketing,
      },
    }),
    db.consentEvent.create({
      data: {
        userId,
        kind: CONSENT_KIND.policyAccept,
        policyVersion: POLICY_VERSION,
        detail: `research=${opts.research} marketing=${opts.marketing}`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);
}

/** Toggle research consent later, from account settings. */
export async function setResearchConsent(userId: string, on: boolean): Promise<void> {
  const meta = await reqMeta();
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { researchConsent: on } }),
    db.consentEvent.create({
      data: {
        userId,
        kind: on ? CONSENT_KIND.researchOptIn : CONSENT_KIND.researchOptOut,
        policyVersion: POLICY_VERSION,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);
}
