import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { waLink } from "@/lib/wa";
import { claimConfirmMessage } from "@/lib/claims";

export const metadata = { title: "Confirm on WhatsApp", robots: { index: false } };

/**
 * Landing spot after a mandatory-search self-claim (docs/onboarding-state-
 * machine.md: CLAIM_REQUESTED). Same "send a code over WhatsApp, wait for
 * the family admin to approve" pattern as the shared-view claim flow at
 * /s/[slug]/claim/sent — kept as a separate route because this claim isn't
 * tied to a shared-view slug, it targets a global Identity directly.
 */
export default async function StartClaimedPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  if (!c) notFound();

  const claim = await db.personClaim.findUnique({
    where: { id: c },
    select: {
      code: true,
      claimantName: true,
      targetIdentityId: true,
      tree: { select: { name: true, contactWhatsapp: true } },
      targetIdentity: {
        select: {
          people: {
            take: 1,
            select: {
              names: {
                select: {
                  first: true,
                  surname: true,
                  surnamePrefix: true,
                  suffix: true,
                  nick: true,
                  title: true,
                  preferred: true,
                  type: true,
                  order: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!claim || !claim.targetIdentityId) notFound();

  const personName = claim.targetIdentity?.people[0] ? displayName(claim.targetIdentity.people[0].names) : null;
  const message = claimConfirmMessage({
    name: claim.claimantName,
    code: claim.code,
    treeName: claim.tree.name,
    personName,
  });
  const hasNumber = Boolean(claim.tree.contactWhatsapp);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10 text-center">
      <h1 className="text-2xl font-semibold">One more step</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Send this to the family admin on WhatsApp so they can confirm it&apos;s really you.
      </p>

      <div
        className="mt-4 rounded-xl border p-4 text-left text-sm"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div style={{ color: "var(--muted)" }}>Your confirmation code</div>
        <div className="text-2xl font-mono font-semibold">{claim.code}</div>
      </div>

      {hasNumber ? (
        <a
          href={waLink(claim.tree.contactWhatsapp!, message)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 rounded-lg bg-brand-600 px-4 py-3 font-medium text-white hover:bg-brand-700"
        >
          Confirm on WhatsApp
        </a>
      ) : (
        <p className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
          Send this message to the family admin on WhatsApp:
          <span className="mt-2 block rounded bg-black/5 p-2 text-left font-mono text-xs">
            {message}
          </span>
        </p>
      )}

      <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
        Once they approve, they&apos;ll send you a one-tap sign-in link on WhatsApp — you&apos;ll get
        your own family tree linked to this identity, not access to theirs.
      </p>
      <Link href="/start" className="mt-6 text-sm font-medium text-brand-600 hover:underline">
        ← Start over
      </Link>
    </main>
  );
}
