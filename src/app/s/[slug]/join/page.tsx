import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { submitClaim } from "../claim/[personId]/actions";

export const metadata = { title: "Ask to join", robots: { index: false } };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const share = await db.sharedView.findUnique({
    where: { slug },
    select: {
      revoked: true,
      expiresAt: true,
      allowClaims: true,
      tree: { select: { name: true, claimPinHash: true } },
    },
  });
  if (!share || share.revoked || !share.allowClaims) notFound();
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Link href={`/s/${slug}`} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Back to the tree
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Not in the tree yet?</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Tell the {share.tree.name} admin who you are and where you fit. They&apos;ll add you in
        the right place — no duplicate.
      </p>

      <form action={submitClaim.bind(null, slug, null)} className="mt-5 flex flex-col gap-3">
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Your name</span>
          <input name="name" required className={field} style={fieldStyle} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Your WhatsApp number</span>
          <input name="phone" required inputMode="tel" placeholder="07XX XXX XXX" className={field} style={fieldStyle} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Who are your parents / how do you connect?</span>
          <textarea name="note" rows={3} required className={field} style={fieldStyle} />
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
      </form>
    </main>
  );
}
