import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { waLink } from "@/lib/wa";
import { claimConfirmMessage } from "@/lib/claims";

export const metadata = { title: "Confirm on WhatsApp", robots: { index: false } };

export default async function ClaimSentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { slug } = await params;
  const { c } = await searchParams;
  if (!c) notFound();

  const claim = await db.personClaim.findUnique({
    where: { id: c },
    select: {
      code: true,
      claimantName: true,
      status: true,
      tree: { select: { name: true, contactWhatsapp: true } },
      person: { select: { names: { select: { first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true, preferred: true, type: true, order: true } } } },
    },
  });
  if (!claim) notFound();

  const personName = claim.person ? displayName(claim.person.names) : null;
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
        Once they approve, they&apos;ll send you a one-tap sign-in link on WhatsApp.
      </p>
      <Link
        href={`/s/${slug}`}
        className="mt-6 text-sm font-medium text-brand-600 hover:underline"
      >
        Back to the tree
      </Link>
    </main>
  );
}
