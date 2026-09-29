import { OrderStatus } from "@prisma/client";

/** The production path an admin walks an order along, after the deposit is verified. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.DEPOSIT_VERIFIED]: OrderStatus.SENT_TO_SUPPLIER,
  [OrderStatus.SENT_TO_SUPPLIER]: OrderStatus.IN_PRODUCTION,
  [OrderStatus.IN_PRODUCTION]: OrderStatus.SHIPPED,
  [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
};
