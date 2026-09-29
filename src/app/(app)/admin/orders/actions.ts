"use server";

import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { NEXT_STATUS } from "@/lib/order-status";

export async function advanceOrder(orderId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true } } },
  });
  if (!order) throw new Error("Order not found");
  const next = NEXT_STATUS[order.status];
  if (!next) throw new Error("This order cannot move forward");

  const supplierName = String(formData.get("supplierName") ?? "").trim().slice(0, 120);
  const cost = Number(formData.get("supplierCostKes"));
  const trackingNote = String(formData.get("trackingNote") ?? "").trim().slice(0, 300);

  // Half upfront before anything reaches a supplier, and the supplier and cost
  // must be known so margin is visible.
  if (next === OrderStatus.SENT_TO_SUPPLIER) {
    if (!supplierName) throw new Error("Enter the supplier");
    if (!Number.isInteger(cost) || cost < 0) throw new Error("Enter the supplier cost in KES");
    await db.orderItem.updateMany({
      where: { orderId },
      data: { supplierName, supplierCostKes: cost, sentToSupplierAt: new Date() },
    });
  }
  if (trackingNote) {
    await db.orderItem.updateMany({ where: { orderId }, data: { trackingNote } });
  }

  await db.order.update({ where: { id: orderId }, data: { status: next } });
  await writeAudit({
    actorId: admin.id,
    action: "order.advance",
    targetType: "order",
    targetId: orderId,
    meta: { from: order.status, to: next },
  });
  revalidatePath("/admin/orders");
}

export async function cancelOrder(orderId: string) {
  const admin = await requirePlatformAdmin();
  await db.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
  await writeAudit({ actorId: admin.id, action: "order.cancel", targetType: "order", targetId: orderId });
  revalidatePath("/admin/orders");
}
