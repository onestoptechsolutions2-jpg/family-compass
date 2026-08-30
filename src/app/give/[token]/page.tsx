import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { fundByToken, fundTotals, fundContributions } from "@/lib/chama";
import { getPaymentSettings } from "@/lib/payments";
import { submitContribution } from "./actions";

export const metadata: Metadata = { title: "Family welfare fund", robots: { index: false } };
export const dynamic = "force-dynamic";

const KES = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return d.toISOString().slice(0, 10);
}

export default async function GivePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ given?: string; err?: string }>;
}) {
  const { token } = await params;
  const { given, err } = await searchParams;

  const fund = await fundByToken(token);
  if (!fund) notFound();

  const [totals, contributions, pay] = await Promise.all([
    fundTotals(fund.id),
    fundContributions(fund.id, { publicOnly: true }),
    getPaymentSettings(),
  ]);

  const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
  const fs = { borderColor: "var(--border)", background: "var(--surface-2)" };
  const payLine = pay.paybillNumber
    ? `Paybill ${pay.paybillNumber}${pay.accountRef ? `, account ${pay.accountRef}` : ""}`
    : pay.tillNumber
      ? `Till ${pay.tillNumber}`
      : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
        {fund.memorial?.slug && (
          <Link href={`/m/${fund.memorial.slug}`} className="text-sm hover:underline" style={{ color: "var(--link)" }}>
            View memorial
          </Link>
        )}
      </header>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
          Family welfare fund
        </p>
        <h1 className="mt-1 font-serif text-2xl">{fund.label}</h1>
        {fund.memorial?.headline && (
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{fund.memorial.headline}</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{KES(totals.confirmedKes)}</span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {fund.targetKes ? `of ${KES(fund.targetKes)}` : `${totals.contributors} contributor${totals.contributors === 1 ? "" : "s"}`}
          </span>
        </div>
        {totals.progress != null && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(totals.progress * 100)}%`, background: "var(--accent)" }} />
          </div>
        )}
        {totals.pledgedKes > 0 && (
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {KES(totals.pledgedKes)} pledged, awaiting the treasurer&apos;s confirmation
          </p>
        )}
      </div>

      {fund.status !== "OPEN" ? (
        <p className="mt-6 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          This fund is now closed. Thank you to everyone who gave.
        </p>
      ) : given ? (
        <div className="mt-6 rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p style={{ color: "var(--success)" }}>Thank you. Your contribution has been recorded.</p>
          <p className="mt-1" style={{ color: "var(--muted)" }}>
            The family&apos;s treasurer will confirm it against the M-Pesa statement — it appears in the
            total once confirmed.
          </p>
        </div>
      ) : (
        <form action={submitContribution.bind(null, token)} className="mt-6 flex flex-col gap-3 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {payLine && (
            <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
              Send your M-Pesa to <strong>{payLine}</strong>
              {pay.businessName ? ` (${pay.businessName})` : ""}, then fill this in so the family can match it.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Your name</span>
              <input name="name" required className={field} style={fs} />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Amount (KES)</span>
              <input name="amountKes" required inputMode="numeric" placeholder="1000" className={field} style={fs} />
            </label>
          </div>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Phone (optional)</span>
            <input name="phone" placeholder="+2547…" className={field} style={fs} />
          </label>
          <fieldset className="rounded-lg border p-3" style={{ borderColor: "var(--hairline)" }}>
            <legend className="px-1 text-xs" style={{ color: "var(--muted)" }}>How did you send it?</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="method" value="MPESA_MANUAL" defaultChecked /> M-Pesa
            </label>
            <label className="mt-1 block text-sm">
              <span style={{ color: "var(--muted)" }}>M-Pesa confirmation code (optional)</span>
              <input name="mpesaCode" placeholder="e.g. SFF7XXQ1 ZK" className={field} style={fs} />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" name="method" value="CASH" /> Cash / handed over
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input type="radio" name="method" value="OTHER" /> Other
            </label>
          </fieldset>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Note (optional)</span>
            <input name="note" placeholder="A word for the family" className={field} style={fs} />
          </label>
          {err && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {err === "amount" ? "Enter a valid amount." : err === "name" ? "Add your name." : err === "closed" ? "This fund is closed." : "Something went wrong — try again."}
            </p>
          )}
          <button className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Record my contribution
          </button>
        </form>
      )}

      {contributions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Recent contributions</h2>
          <ul className="mt-2 flex flex-col">
            {contributions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium">{c.contributorName}</span>
                <span>
                  {KES(c.amountKes)}
                  <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>{timeAgo(c.confirmedAt ?? c.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        A family welfare fund on Family Compass. Contributions are confirmed by the family treasurer.
      </footer>
    </main>
  );
}
