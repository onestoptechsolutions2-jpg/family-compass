import { JobStatus, OrderStatus, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * What the owner needs to know to run this as a business: what came in, what it cost to make,
 * what is left, what is stuck, and what is owed. `summarise` is pure (facts in, numbers out) so
 * every definition below is tested; `loadMetrics` only fetches the facts.
 *
 * Definitions, in whole KES:
 *  - revenue   = payments confirmed PAID (the price due, not tips or overpayments)
 *  - refunds   = money given back on those payments
 *  - net       = revenue - refunds
 *  - cost      = what partners agreed to charge, for work that was not cancelled
 *  - margin    = net - cost, and margin % = margin / net
 *  - owed      = partner cost for delivered work not yet paid out
 */
export type JobFact = { status: JobStatus; agreedCostKes: number | null; paidOut: boolean; dueAt: Date | null };
export type ItemFact = { productSlug: string; productName: string; quantity: number; unitPriceKes: number; jobs: JobFact[] };
export type PaymentFact = { status: PaymentStatus; amountKes: number; refundedKes: number; createdAt: Date };
export type OrderFact = { id: string; status: OrderStatus; createdAt: Date; totalKes: number; payments: PaymentFact[]; items: ItemFact[] };

export type ProductRow = { slug: string; name: string; units: number; revenueKes: number; costKes: number; marginKes: number };

export type Metrics = {
  designsStarted: number;
  ordersPlaced: number;
  ordersPaid: number;
  ordersCancelled: number;
  /** paid orders out of designs started, 0 to 1, or null when nothing was started */
  conversion: number | null;
  revenueKes: number;
  refundsKes: number;
  netKes: number;
  costKes: number;
  marginKes: number;
  /** margin as a share of net revenue, or null when there is no revenue */
  marginPct: number | null;
  averageOrderKes: number | null;
  /** paid orders where some work has no agreed cost yet, so the margin is not final */
  unpricedOrders: number;
  unpricedRevenueKes: number;
  owedToPartnersKes: number;
  waitingForPayment: { count: number; amountKes: number; staleCount: number; staleAmountKes: number; oldestDays: number | null };
  waitingForCheck: { count: number; oldestHours: number | null };
  overdueJobs: number;
  /** work accepted at a price that leaves nothing, or less, from what the customer paid for that item */
  lossMakingItems: { slug: string; name: string; revenueKes: number; costKes: number }[];
  byProduct: ProductRow[];
};

const DAY = 864e5;
export const STALE_UNPAID_DAYS = 3;

const countsAsCost = (j: JobFact) => j.status !== JobStatus.CANCELLED && j.agreedCostKes != null;

export function summarise(orders: OrderFact[], designsStarted: number, now: Date = new Date()): Metrics {
  const placed = orders.filter((o) => o.status !== OrderStatus.DRAFT);
  const paidSum = (o: OrderFact) => o.payments.filter((p) => p.status === PaymentStatus.PAID).reduce((n, p) => n + p.amountKes, 0);
  const refundSum = (o: OrderFact) => o.payments.filter((p) => p.status === PaymentStatus.PAID).reduce((n, p) => n + p.refundedKes, 0);
  const paidOrders = placed.filter((o) => paidSum(o) > 0);

  const revenueKes = paidOrders.reduce((n, o) => n + paidSum(o), 0);
  const refundsKes = paidOrders.reduce((n, o) => n + refundSum(o), 0);
  const jobsOf = (o: OrderFact) => o.items.flatMap((i) => i.jobs);
  const costKes = paidOrders.reduce((n, o) => n + jobsOf(o).filter(countsAsCost).reduce((m, j) => m + (j.agreedCostKes ?? 0), 0), 0);
  const netKes = revenueKes - refundsKes;
  const marginKes = netKes - costKes;

  // work that is still to be priced: a paid, live order where a stage has no agreed cost yet
  const unpriced = paidOrders.filter(
    (o) => o.status !== OrderStatus.CANCELLED && (jobsOf(o).length === 0 || jobsOf(o).some((j) => j.status !== JobStatus.CANCELLED && j.agreedCostKes == null)),
  );

  const unpaid = placed.filter((o) => o.status === OrderStatus.AWAITING_DEPOSIT);
  const stale = unpaid.filter((o) => now.getTime() - o.createdAt.getTime() > STALE_UNPAID_DAYS * DAY);
  const awaitingCheck = orders.flatMap((o) => o.payments).filter((p) => p.status === PaymentStatus.AWAITING_VERIFICATION);
  const oldest = (ds: Date[]) => (ds.length ? Math.min(...ds.map((d) => d.getTime())) : null);
  const oldestUnpaid = oldest(unpaid.map((o) => o.createdAt));
  const oldestCheck = oldest(awaitingCheck.map((p) => p.createdAt));

  const rows = new Map<string, ProductRow>();
  const loss: Metrics["lossMakingItems"] = [];
  for (const o of paidOrders) {
    if (o.status === OrderStatus.CANCELLED) continue;
    for (const i of o.items) {
      const revenue = i.unitPriceKes * i.quantity;
      const cost = i.jobs.filter(countsAsCost).reduce((n, j) => n + (j.agreedCostKes ?? 0), 0);
      const r = rows.get(i.productSlug) ?? { slug: i.productSlug, name: i.productName, units: 0, revenueKes: 0, costKes: 0, marginKes: 0 };
      r.units += i.quantity;
      r.revenueKes += revenue;
      r.costKes += cost;
      r.marginKes = r.revenueKes - r.costKes;
      rows.set(i.productSlug, r);
      if (cost > 0 && cost >= revenue) loss.push({ slug: i.productSlug, name: i.productName, revenueKes: revenue, costKes: cost });
    }
  }

  return {
    designsStarted,
    ordersPlaced: placed.length,
    ordersPaid: paidOrders.length,
    ordersCancelled: placed.filter((o) => o.status === OrderStatus.CANCELLED).length,
    conversion: designsStarted > 0 ? Math.min(1, paidOrders.length / designsStarted) : null,
    revenueKes,
    refundsKes,
    netKes,
    costKes,
    marginKes,
    marginPct: netKes > 0 ? marginKes / netKes : null,
    averageOrderKes: paidOrders.length ? Math.round(revenueKes / paidOrders.length) : null,
    unpricedOrders: unpriced.length,
    unpricedRevenueKes: unpriced.reduce((n, o) => n + paidSum(o), 0),
    owedToPartnersKes: placed.flatMap(jobsOf).filter((j) => j.status === JobStatus.DELIVERED && !j.paidOut).reduce((n, j) => n + (j.agreedCostKes ?? 0), 0),
    waitingForPayment: {
      count: unpaid.length,
      amountKes: unpaid.reduce((n, o) => n + o.totalKes, 0),
      staleCount: stale.length,
      staleAmountKes: stale.reduce((n, o) => n + o.totalKes, 0),
      oldestDays: oldestUnpaid === null ? null : Math.floor((now.getTime() - oldestUnpaid) / DAY),
    },
    waitingForCheck: { count: awaitingCheck.length, oldestHours: oldestCheck === null ? null : Math.floor((now.getTime() - oldestCheck) / 36e5) },
    overdueJobs: placed
      .flatMap(jobsOf)
      .filter((j) => (j.status === JobStatus.ASSIGNED || j.status === JobStatus.IN_PRODUCTION) && j.dueAt !== null && j.dueAt.getTime() < now.getTime()).length,
    lossMakingItems: loss,
    byProduct: [...rows.values()].sort((a, b) => b.revenueKes - a.revenueKes),
  };
}

/** Fetch the facts for orders created since `since` (everything when null) and summarise them. */
export async function loadMetrics(since: Date | null, now: Date = new Date()): Promise<Metrics> {
  const where = since ? { createdAt: { gte: since } } : {};
  const [orders, designsStarted] = await Promise.all([
    db.order.findMany({
      where: { ...where, status: { not: OrderStatus.DRAFT } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        totalKes: true,
        payments: { select: { status: true, amountKes: true, refundedKes: true, createdAt: true } },
        items: {
          select: {
            quantity: true,
            unitPriceKes: true,
            product: { select: { slug: true, name: true } },
            jobs: { select: { status: true, agreedCostKes: true, paidOutAt: true, dueAt: true } },
          },
        },
      },
    }),
    db.order.count({ where: { ...where, guestToken: { not: null } } }),
  ]);
  const facts: OrderFact[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    createdAt: o.createdAt,
    totalKes: o.totalKes,
    payments: o.payments,
    items: o.items.map((i) => ({
      productSlug: i.product.slug,
      productName: i.product.name,
      quantity: i.quantity,
      unitPriceKes: i.unitPriceKes,
      jobs: i.jobs.map((j) => ({ status: j.status, agreedCostKes: j.agreedCostKes, paidOut: j.paidOutAt !== null, dueAt: j.dueAt })),
    })),
  }));
  return summarise(facts, designsStarted, now);
}
