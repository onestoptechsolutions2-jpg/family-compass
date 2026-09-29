import { OrderStatus } from "@prisma/client";

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
