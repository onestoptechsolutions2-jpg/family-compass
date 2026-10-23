import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { publicOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/rbac";
import { getPaymentSettings } from "@/lib/payments";
import { CopyButton } from "@/components/CopyButton";
import { ShopHeader } from "@/components/ShopHeader";
import { updatePayoutPhone } from "../actions";

export const metadata = { title: "Your referrals" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { PENDING: "To be paid", PAID: "Paid", CANCELLED: "Order cancelled" };
const card = "rounded-2xl border p-5 text-sm";
const cardStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;

export default async function ReferDashboard({ searchParams }: { searchParams: Promise<{ new?: string; saved?: string; error?: string }> }) {
  const user = await requireUser();
  const { new: isNew, saved, error } = await searchParams;
  const r = await db.referrer.findUnique({
    where: { userId: user.id },
    include: { commissions: { orderBy: { createdAt: "desc" }, take: 100 } },
  });
  if (!r) redirect("/refer");
  const origin = await publicOrigin();
  const link = `${origin}/r/${r.code}`;
  const percent = r.percent ?? (await getPaymentSettings()).referralPercent;
  // orders placed with the code but not yet paid: counted, never shown
  const waiting = await db.order.count({ where: { referrerId: r.id, status: "AWAITING_DEPOSIT" } });
  const sum = (s: string) => r.commissions.filter((c) => c.status === s).reduce((n, c) => n + c.amountKes, 0);
  const share = `Planning a funeral or a family keepsake? Family Compass designs and prints it, delivered countrywide: ${link}`;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <ShopHeader />
      <h1 className="font-serif text-3xl text-[var(--fg)]">Your referrals</h1>
      {isNew && <p className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>Welcome, {r.name}. Share your link below; you earn {percent}% on every order it brings.</p>}
      {saved && <p className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>Saved.</p>}
      {error && <p className="mt-3 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}
      {r.status !== "ACTIVE" && (
        <p className="mt-3 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>Your referral link is paused. Contact us on WhatsApp to talk about it.</p>
      )}

      <section className={`${card} mt-6`} style={cardStyle}>
        <h2 className="font-medium">Your link and code</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="break-all rounded-md border px-2 py-1" style={{ borderColor: "var(--border)" }}>{link}</code>
          <CopyButton value={link} />
        </div>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          Or give families your code, <strong className="font-mono text-[var(--fg)]">{r.code}</strong>, to type at checkout. A family who opens your link is credited to you for 30 days.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Share on WhatsApp</a>
          <CopyButton value={share} label="Copy a message" />
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["To be paid", kes(sum("PENDING"))],
          ["Paid to you", kes(sum("PAID"))],
          ["Orders waiting for payment", String(waiting)],
        ].map(([t, v]) => (
          <div key={t} className={card} style={cardStyle}>
            <p style={{ color: "var(--muted)" }}>{t}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </section>

      <section className={`${card} mt-4`} style={cardStyle}>
        <h2 className="font-medium">Orders you brought</h2>
        {r.commissions.length === 0 ? (
          <p className="mt-2" style={{ color: "var(--muted)" }}>None paid yet. When a family you sent pays for their order, it shows here.</p>
        ) : (
          <table className="mt-3 w-full text-left">
            <thead style={{ color: "var(--muted)" }}>
              <tr><th className="py-1 font-normal">Date</th><th className="py-1 font-normal">Order</th><th className="py-1 font-normal">You earn</th><th className="py-1 font-normal">Status</th></tr>
            </thead>
            <tbody>
              {r.commissions.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2">{c.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="py-2">{kes(c.orderKes)}</td>
                  <td className="py-2 font-medium">{kes(c.amountKes)} <span className="text-xs" style={{ color: "var(--muted)" }}>({c.percent}%)</span></td>
                  <td className="py-2">{STATUS_LABEL[c.status] ?? c.status}{c.payoutRef ? ` · ${c.payoutRef}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>For the families&apos; privacy we show the amount of each order, not who placed it.</p>
      </section>

      <section className={`${card} mt-4`} style={cardStyle}>
        <h2 className="font-medium">Where we send your earnings</h2>
        <form action={updatePayoutPhone} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1">
            <span style={{ color: "var(--muted)" }}>M-Pesa number</span>
            <input name="payoutPhone" defaultValue={`0${r.payoutPhone.slice(3)}`} inputMode="tel" className="mt-1 w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg)" }} />
          </label>
          <button className="rounded-md border px-4 py-2" style={{ borderColor: "var(--border)" }}>Save</button>
        </form>
      </section>
      <p className="mt-6 text-sm"><Link href="/shop" className="underline">See what families can order</Link></p>
    </main>
  );
}
