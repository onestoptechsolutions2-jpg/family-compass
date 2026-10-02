import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/rbac";
import { loadMetrics } from "@/lib/business-metrics";
import { kes } from "@/lib/money";

export const metadata = { title: "Money" };
export const dynamic = "force-dynamic";

const PERIODS = [
  ["30", "Last 30 days", 30],
  ["90", "Last 90 days", 90],
  ["all", "All time", null],
] as const;

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

/** The shop as a business: what came in, what it cost, what is left, what is stuck and what is owed. */
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requirePlatformAdmin();
  const { period = "30" } = await searchParams;
  const chosen = PERIODS.find((p) => p[0] === period) ?? PERIODS[0];
  const since = chosen[2] === null ? null : new Date(Date.now() - chosen[2] * 864e5);
  const m = await loadMetrics(since);

  const Card = ({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "bad" | "good" }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: tone === "bad" ? "var(--danger)" : tone === "good" ? "var(--success)" : undefined }}>{value}</p>
      {note && <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{note}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Money</h1>
        <nav className="flex gap-2 text-sm">
          {PERIODS.map(([key, label]) => (
            <Link key={key} href={`/admin/money?period=${key}`} className="rounded-full border px-3 py-1" style={{ borderColor: "var(--border)", fontWeight: chosen[0] === key ? 600 : 400 }}>{label}</Link>
          ))}
        </nav>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Revenue" value={kes(m.revenueKes)} note={`${m.ordersPaid} paid ${m.ordersPaid === 1 ? "order" : "orders"}${m.averageOrderKes ? `, average ${kes(m.averageOrderKes)}` : ""}`} />
        <Card label="Refunds" value={kes(m.refundsKes)} note={m.ordersCancelled ? `${m.ordersCancelled} cancelled` : undefined} />
        <Card label="Partner cost" value={kes(m.costKes)} note="agreed prices for work not cancelled" />
        <Card label="Margin" value={kes(m.marginKes)} note={`${pct(m.marginPct)} of ${kes(m.netKes)} net`} tone={m.marginKes < 0 ? "bad" : m.marginKes > 0 ? "good" : undefined} />
      </section>
      {m.unpricedOrders > 0 && (
        <p className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
          {m.unpricedOrders} paid {m.unpricedOrders === 1 ? "order" : "orders"} ({kes(m.unpricedRevenueKes)}) {m.unpricedOrders === 1 ? "has" : "have"} work with no agreed price yet, so the margin above is not final.
        </p>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>Needs you</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Payments to check"
            value={String(m.waitingForCheck.count)}
            note={m.waitingForCheck.oldestHours !== null ? `oldest ${m.waitingForCheck.oldestHours} h` : "nothing waiting"}
            tone={m.waitingForCheck.oldestHours !== null && m.waitingForCheck.oldestHours > 24 ? "bad" : undefined}
          />
          <Card
            label="Placed, not paid"
            value={kes(m.waitingForPayment.amountKes)}
            note={`${m.waitingForPayment.count} ${m.waitingForPayment.count === 1 ? "order" : "orders"}${m.waitingForPayment.staleCount ? `, ${m.waitingForPayment.staleCount} over 3 days (${kes(m.waitingForPayment.staleAmountKes)})` : ""}`}
            tone={m.waitingForPayment.staleCount ? "bad" : undefined}
          />
          <Card label="Owed to partners" value={kes(m.owedToPartnersKes)} note="delivered work not yet paid out" tone={m.owedToPartnersKes > 0 ? "bad" : undefined} />
          <Card label="Overdue work" value={String(m.overdueJobs)} note="past the date the maker agreed" tone={m.overdueJobs ? "bad" : undefined} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>From design to payment</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <Card label="Designs started" value={String(m.designsStarted)} />
          <Card label="Orders placed" value={String(m.ordersPlaced)} />
          <Card label="Paid" value={String(m.ordersPaid)} />
          <Card label="Started to paid" value={pct(m.conversion)} note="the share of designs that became a paid order" />
        </div>
      </section>

      {m.lossMakingItems.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--danger)" }}>Made at a loss</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {m.lossMakingItems.map((l, i) => (
              <li key={i}>{l.name}: customer paid {kes(l.revenueKes)}, partner cost {kes(l.costKes)}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>By product</h2>
        {m.byProduct.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No paid orders in this period.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead style={{ color: "var(--muted)" }}>
              <tr><th className="py-1">Product</th><th>Sold</th><th>Revenue</th><th>Partner cost</th><th>Margin</th></tr>
            </thead>
            <tbody>
              {m.byProduct.map((r) => (
                <tr key={r.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-1.5">{r.name}</td>
                  <td>{r.units}</td>
                  <td>{kes(r.revenueKes)}</td>
                  <td>{r.costKes ? kes(r.costKes) : "not priced yet"}</td>
                  <td className={r.costKes && r.marginKes <= 0 ? "text-red-600" : ""}>{r.costKes ? `${kes(r.marginKes)} (${pct(r.marginKes / Math.max(1, r.revenueKes))})` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
