import { JobStatus, OrderStatus } from "@prisma/client";

/** What customers and admins read, in place of the enum names. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  AWAITING_DEPOSIT: "Awaiting payment",
  DEPOSIT_VERIFIED: "Paid, ready for production",
  IN_DESIGN: "In design",
  APPROVED: "Approved",
  SENT_TO_SUPPLIER: "With a partner",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export type ItemLike = {
  shippedAt: Date | null;
  deliveredAt: Date | null;
  customerTracking: string | null;
  jobs: { status: JobStatus }[];
};

/** What the customer reads about one item, in plain words. */
export function itemStatus(item: ItemLike, order: OrderStatus): string {
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

