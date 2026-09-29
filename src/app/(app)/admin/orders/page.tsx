import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { publicOrigin } from "@/lib/origin";
import { requirePlatformAdmin } from "@/lib/rbac";
import { NEXT_STATUS } from "@/lib/order-status";
import { advanceOrder, cancelOrder } from "./actions";

export const metadata = { title: "Production queue" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border px-3 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;

export default async function AdminOrdersPage() {
  await requirePlatformAdmin();
  const origin = await publicOrigin();
  const orders = await db.order.findMany({
    where: { status: { not: OrderStatus.DRAFT } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } }, qrCode: { select: { code: true } } } },
      payments: { select: { kind: true, status: true, amountKes: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Production queue</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Verify the deposit under Payments first. Then send to the supplier, and move the order along.
      </p>
      {orders.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No orders yet.</p>}
      {orders.map((o) => {
        const cost = o.items.reduce((n, i) => n + (i.supplierCostKes ?? 0) * i.quantity, 0);
        const hasCost = o.items.some((i) => i.supplierCostKes != null);
        const next = NEXT_STATUS[o.status];
        const paid = o.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amountKes, 0);
        return (
          <div key={o.id} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-xs">{o.id.slice(-8)}</span>
              <span className="font-medium">{o.status.toLowerCase().replace(/_/g, " ")}</span>
              <span style={{ color: "var(--muted)" }}>
                {o.contactName ?? o.user?.name ?? o.user?.email} · {o.contactPhone ?? ""}
              </span>
            </div>
            {o.items.map((i) => {
              const snap = (i.layoutSnapshot ?? {}) as { name?: string; epitaph?: string };
              return (
                <div key={i.id} className="mt-2">
                  <div className="font-medium">{i.product.name}: {snap.name ?? "—"}</div>
                  {snap.epitaph && <div className="italic" style={{ color: "var(--muted)" }}>&ldquo;{snap.epitaph}&rdquo;</div>}
                  {i.qrCode && (
                    <div className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                      QR {origin}/q/{i.qrCode.code}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="mt-2" style={{ color: "var(--muted)" }}>
              Deliver to: {o.deliveryText ?? "—"}
            </p>
            <p className="mt-2">
              Total {kes(o.totalKes)} · paid {kes(paid)}
              {hasCost && <> · supplier cost {kes(cost)} · margin {kes(o.totalKes - cost)}</>}
            </p>
            {next && (
              <form action={advanceOrder.bind(null, o.id)} className="mt-3 flex flex-wrap items-center gap-2">
                {next === OrderStatus.SENT_TO_SUPPLIER && (
                  <>
                    <input name="supplierName" placeholder="Supplier" required className={field} style={fieldStyle} />
                    <input name="supplierCostKes" type="number" min={0} placeholder="Cost KES" required className={field} style={fieldStyle} />
                  </>
                )}
                <input name="trackingNote" placeholder="Note or tracking (optional)" className={field} style={fieldStyle} />
                <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
                  Mark {next.toLowerCase().replace(/_/g, " ")}
                </button>
              </form>
            )}
            {o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED && (
              <form action={cancelOrder.bind(null, o.id)} className="mt-2">
                <button className="text-xs underline" style={{ color: "var(--muted)" }}>Cancel order</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
