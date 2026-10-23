import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { getPaymentSettings } from "@/lib/payments";
import { REFERRER_KINDS } from "@/lib/referrals";
import { ShopHeader } from "@/components/ShopHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { becomeReferrer } from "./actions";

export const metadata: Metadata = {
  title: "Earn by referring families",
  description: "Funeral homes, churches and anyone who helps families: share your link and earn on every order it brings, paid to your M-Pesa.",
};
export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-lg border px-4 py-2.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;

export default async function ReferPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getSessionUser();
  if (user && (await db.referrer.findUnique({ where: { userId: user.id }, select: { id: true } }))) redirect("/refer/dashboard");
  const { referralPercent } = await getPaymentSettings();

  const steps = [
    ["Sign up", "Your name, or your organisation's, and the M-Pesa number to pay. It takes a minute."],
    ["Share your link", "Send it on WhatsApp, print it at your front desk, or give families your code to type at checkout."],
    ["Earn on every order", `When a family you sent pays, you earn ${referralPercent}% of what they paid. You can follow every order on your page.`],
    ["Get paid by M-Pesa", "We send what you have earned to your M-Pesa number."],
  ] as const;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <ShopHeader />
      <section className="mt-2">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>For funeral homes, churches and anyone who helps families</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-[var(--fg)] sm:text-4xl">Earn {referralPercent}% on every family you send us</h1>
        <p className="mt-3 text-base" style={{ color: "var(--muted)" }}>
          Families need a funeral programme within days, and later a plaque, a tombstone tree or a family tree for the wall.
          Point them to us: they get a designed, printed piece delivered countrywide, and you earn on every order they pay for.
        </p>
      </section>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <p className="font-semibold">{i + 1}. {t}</p>
            <p className="mt-1" style={{ color: "var(--muted)" }}>{d}</p>
          </li>
        ))}
      </ol>

      <section id="join" className="mt-8 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <h2 className="font-serif text-2xl">Become a referrer</h2>
        {error && <p role="alert" className="mt-3 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}
        {!user ? (
          <div className="mt-3 text-sm">
            <p style={{ color: "var(--muted)" }}>First create a free account, so your earnings are kept safe under your name.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/join?next=/refer%23join" className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">Create an account</Link>
              <Link href="/login?callbackUrl=%2Frefer%23join" className="rounded-md border px-5 py-2.5 font-medium" style={{ borderColor: "var(--border)" }}>I have an account</Link>
            </div>
          </div>
        ) : (
          <form action={becomeReferrer} className="mt-4 flex flex-col gap-4">
            <label>
              <span className="text-sm font-medium">Your name, or your organisation&apos;s</span>
              <input name="name" required minLength={2} maxLength={120} defaultValue={user.name ?? ""} className={field} style={fieldStyle} placeholder="e.g. Upendo Funeral Home" />
            </label>
            <label>
              <span className="text-sm font-medium">You are</span>
              <select name="kind" defaultValue="individual" className={field} style={fieldStyle}>
                {REFERRER_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">M-Pesa number for your earnings</span>
              <input name="payoutPhone" required inputMode="tel" maxLength={20} className={field} style={fieldStyle} placeholder="0712 345 678" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="agree" required className="mt-1" />
              <span style={{ color: "var(--muted)" }}>
                I agree: I earn {referralPercent}% of what a family I send pays for their order (delivery included in the price). Nothing is earned on my own orders or on
                an order that is cancelled, and earnings are paid by M-Pesa once the order is confirmed. The rate may change for future orders.
              </span>
            </label>
            <button className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Get my referral link</button>
          </form>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
