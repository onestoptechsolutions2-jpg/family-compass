"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/** Change the price, description and visibility of a catalogue product. */
export async function updateProduct(productId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const price = Number(formData.get("basePriceKes"));
  if (!Number.isInteger(price) || price < 0) throw new Error("Enter the price in whole KES");
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 300);
  const active = formData.get("active") === "on";

  await db.product.update({
    where: { id: productId },
    data: { basePriceKes: price, active, ...(summary ? { summary } : {}) },
  });
  await writeAudit({
    actorId: admin.id,
    action: "product.update",
    targetType: "product",
    targetId: productId,
    meta: { basePriceKes: price, active },
  });
  revalidatePath("/admin/products");
  revalidatePath("/remembered");
}
