import { OrderStatus } from "@prisma/client";

/** What customers and admins read, in place of the enum names. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  AWAITING_DEPOSIT: "Awaiting payment",
  DEPOSIT_VERIFIED: "Paid, ready for production",
  IN_DESIGN: "In design",
  APPROVED: "Approved",
  SENT_TO_SUPPLIER: "Sent to partner",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** The production path an admin walks an order along, after the deposit is verified. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.DEPOSIT_VERIFIED]: OrderStatus.SENT_TO_SUPPLIER,
  [OrderStatus.SENT_TO_SUPPLIER]: OrderStatus.IN_PRODUCTION,
  [OrderStatus.IN_PRODUCTION]: OrderStatus.SHIPPED,
  [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
};
