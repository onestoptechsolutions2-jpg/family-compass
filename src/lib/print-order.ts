import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { renderPrintSheet, type PrintSheet } from "@/lib/print-sheet";
import type { DraftOptions } from "@/lib/order-shared";

/**
 * The print sheet for one approved order item, from the layout frozen at
 * approval, never the live family record. Null if there is nothing to print yet.
 */
export async function renderItemSheet(itemId: string): Promise<{ sheet: PrintSheet } | null> {
  const item = await db.orderItem.findUnique({
    where: { id: itemId },
    include: { product: true, qrCode: true },
  });
  if (!item?.qrCode || !item.approvedAt) return null;
  const options = (item.layoutSnapshot ?? item.options ?? {}) as DraftOptions;
  const sheet = await renderPrintSheet(
    {
      options,
      productName: item.product.name,
      qrUrl: `${await publicOrigin()}/q/${item.qrCode.code}`,
      pathway: item.product.pathway,
    },
    options.sizeKey,
  );
  return { sheet };
}
