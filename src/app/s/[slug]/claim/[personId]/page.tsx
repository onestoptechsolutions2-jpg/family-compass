import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { submitClaim } from "./actions";

export const metadata = { title: "Claim your profile", robots: { index: false } };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" };

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slug: string; personId: string }>;
}) {
  const { slug, personId } = await params;

  const share = await db.sharedView.findUnique({
    where: { slug },
    select: {
      treeId: true,
      revoked: true,
      expiresAt: true,
      allowClaims: true,
      tree: { select: { name: true, claimPinHash: true } },
    },
  });
  if (!share || share.revoked || !share.allowClaims) notFound();
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) notFound();

  const person = await db.person.findFirst({
    where: { id: personId, treeId: share.treeId },
    select: {
      id: true,
      claimedByUserId: true,
      names: {
        select: { first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true, preferred: true, type: true, order: true },
      },
      eventRefs: { where: { event: { type: { in: ["Death", "Burial"] } } }, select: { id: true } },
    },
  });
  if (!person) notFound();

  const name = displayName(person.names);
  const blocked = person.claimedByUserId
    ? "Someone has already claimed this profile."
    : person.eventRefs.length > 0
      ? "This person has a recorded death and can't be claimed."
      : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Link href={`/s/${slug}`} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Back to the tree
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Is this you?</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        <strong>{name}</strong> in the {share.tree.name} tree.
      </p>

      {blocked ? (
        <p className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>
          {blocked}
        </p>
      ) : (
        <form
          action={submitClaim.bind(null, slug, personId)}
          className="mt-5 flex flex-col gap-3"
        >
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your name</span>
            <input name="name" required defaultValue={name} className={field} style={fieldStyle} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your WhatsApp number</span>
            <input
              name="phone"
              required
              inputMode="tel"
              placeholder="07XX XXX XXX"
              className={field}
              style={fieldStyle}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Note for the family admin (optional)</span>
            <textarea
              name="note"
              rows={2}
              placeholder="e.g. son of Peter Dindi"
              className={field}
              style={fieldStyle}
            />
          </label>
          {share.tree.claimPinHash && (
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Family word</span>
              <input name="pin" required className={field} style={fieldStyle} />
            </label>
          )}
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Continue
          </button>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Next you&apos;ll send a one-tap WhatsApp message so the admin can confirm it&apos;s
            really you. Nothing is created until they approve. Your name and number are used
            only for this — see the{" "}
            <a href="/policies/privacy" target="_blank" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      )}
    </main>
  );
}
