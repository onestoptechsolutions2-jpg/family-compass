import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { requirePlatformAdmin } from "@/lib/rbac";
import { getPaymentSettings } from "@/lib/payments";
import { REFERRER_KINDS } from "@/lib/referrals";
import { markReferrerPaid, updateReferrer } from "./actions";

export const metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border px-3 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;
const KIND = Object.fromEntries(REFERRER_KINDS) as Record<string, string>;

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePlatformAdmin();
  const { error } = await searchParams;
  const { referralPercent } = await getPaymentSettings();
  const referrers = await db.referrer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      commissions: { select: { status: true, amountKes: true, orderKes: true } },
      _count: { select: { orders: true } },
    },
  });
  const rows = referrers.map((r) => {
    const sum = (s: string) => r.commissions.filter((c) => c.status === s).reduce((n, c) => n + c.amountKes, 0);
    return { r, owed: sum("PENDING"), paid: sum("PAID"), sales: r.commissions.filter((c) => c.status !== "CANCELLED").reduce((n, c) => n + c.orderKes, 0) };
  });
  rows.sort((a, b) => b.owed - a.owed);
  const totalOwed = rows.reduce((n, x) => n + x.owed, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Referrals</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Anyone can sign up at /refer. A referrer earns {referralPercent}% (change it in Settings, or per referrer below) of what a family they sent pays.
        A commission is recorded when you approve the payment and cancelled if you cancel the order. Send the money by M-Pesa, then record it here with the confirmation code.
      </p>
      {error && <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}
      <p className="text-sm font-medium">Owed now: {kes(totalOwed)} to {rows.filter((x) => x.owed > 0).length} referrers</p>

      {rows.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No referrers yet. Share /refer with funeral homes and churches.</p>}
      {rows.map(({ r, owed, paid, sales }) => (
        <div key={r.id} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-semibold">{r.name} <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{r.code}</span></p>
              <p style={{ color: "var(--muted)" }}>{KIND[r.kind] ?? r.kind} · {r.user.email} · M-Pesa 0{r.payoutPhone.slice(3)} · joined {r.createdAt.toISOString().slice(0, 10)}</p>
            </div>
            <p className={r.status === "ACTIVE" ? "" : "text-red-600"}>{r.status === "ACTIVE" ? "Active" : "Paused"}</p>
          </div>
          <p className="mt-2">
            {r._count.orders} orders placed · {kes(sales)} paid by their families · owed <strong>{kes(owed)}</strong> · paid {kes(paid)}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            {owed > 0 && (
              <form action={markReferrerPaid.bind(null, r.id)} className="flex flex-wrap items-end gap-2">
                <label className="text-xs">M-Pesa code of the payout ({kes(owed)})
                  <input name="payoutRef" required minLength={6} maxLength={20} className={`${field} mt-1 block font-mono uppercase`} style={fieldStyle} placeholder="SJK3XXXXXX" />
                </label>
                <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">Record as paid</button>
              </form>
            )}
            <form action={updateReferrer.bind(null, r.id)} className="flex flex-wrap items-end gap-2">
              <label className="text-xs">Own rate %
                <input name="percent" type="number" min={0} max={50} defaultValue={r.percent ?? ""} placeholder={String(referralPercent)} className={`${field} mt-1 block w-24`} style={fieldStyle} />
              </label>
              <label className="text-xs">Status
                <select name="status" defaultValue={r.status} className={`${field} mt-1 block`} style={fieldStyle}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Paused</option>
                </select>
              </label>
              <button className="rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>Save</button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
