import Link from "next/link";
import { JobStatus, OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { ShopHeader } from "@/components/ShopHeader";

export const metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

type ItemLike = {
  shippedAt: Date | null;
  deliveredAt: Date | null;
  customerTracking: string | null;
  jobs: { status: JobStatus }[];
};

/** What the customer reads about one item, in plain words. */
function itemStatus(item: ItemLike, order: OrderStatus): string {
  if (item.deliveredAt) return "Delivered";
  if (item.shippedAt) return item.customerTracking ? `On its way · ${item.customerTracking}` : "On its way";
  if (order === OrderStatus.AWAITING_DEPOSIT) return "Waiting for your payment";
  if (order === OrderStatus.CANCELLED) return "Cancelled";
  const s = item.jobs.map((j) => j.status);
  if (s.some((x) => x === JobStatus.SHIPPED || x === JobStatus.DELIVERED)) return "Quality check";
  if (s.some((x) => x === JobStatus.PROOF_SUBMITTED || x === JobStatus.PROOF_APPROVED)) return "Finished, being checked";
  if (s.some((x) => x === JobStatus.IN_PRODUCTION)) return "Being made";
  if (s.some((x) => x === JobStatus.ASSIGNED)) return "Assigned to a maker";
  return "Paid, getting ready";
}

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
        <ShopHeader />
        <h1 className="font-serif text-3xl text-[#3b2a1c]">My orders</h1>
        <Link href="/login?callbackUrl=%2Forders" className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white">Sign in with Google</Link>
      </main>
    );
  }
  const origin = await publicOrigin();
  const orders = await db.order.findMany({
    // a guest draft that was merged into a cart is not an order (a null note must still count as one)
    where: {
      userId: user.id,
      status: { not: OrderStatus.DRAFT },
      OR: [{ notes: null }, { notes: { not: { startsWith: "merged:" } } }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      payments: { where: { kind: "ORDER_DEPOSIT" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: { product: { select: { name: true } }, qrCode: { select: { code: true } }, jobs: { select: { status: true } } },
      },
    },
  });

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <ShopHeader />
      <h1 className="font-serif text-3xl text-[#3b2a1c]">My orders</h1>
      {orders.length === 0 && (
        <div className="mt-6 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)" }}>
          <p className="font-medium">You have not ordered anything yet.</p>
          <Link href="/shop" className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 font-medium text-white">Browse the shop</Link>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-4">
        {orders.map((o) => {
          const pay = o.payments[0];
          return (
            <article key={o.id} className="rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>Order {o.id.slice(-8).toUpperCase()}</span>
                  <span className="ml-3" style={{ color: "var(--muted)" }}>{o.createdAt.toISOString().slice(0, 10)}</span>
                </div>
                <span className="font-medium">{ORDER_STATUS_LABEL[o.status]}</span>
              </div>

              <ul className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
                {o.items.map((i) => {
                  const snap = (i.layoutSnapshot ?? {}) as { name?: string };
                  return (
                    <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2" style={{ borderColor: "var(--border)" }}>
                      <div>
                        <div className="font-medium">{i.product.name}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</div>
                        <div style={{ color: "var(--muted)" }}>
                          {snap.name}
                          {i.qrCode && <> · <a href={`${origin}/q/${i.qrCode.code}`} className="underline">open its page</a></>}
                        </div>
                      </div>
                      <div className="text-right">{itemStatus(i, o.status)}</div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <span>Total {kes(o.totalKes)} · delivery included</span>
                {o.status === OrderStatus.AWAITING_DEPOSIT && pay && (
                  <Link href={`/pay/${pay.id}`} className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white">
                    {pay.status === "AWAITING_VERIFICATION" ? "Payment being checked" : "Pay now"}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
