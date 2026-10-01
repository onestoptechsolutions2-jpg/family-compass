"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";

const wholeKes = (v: FormDataEntryValue | null, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw new Error(`${what}: enter a whole number of KES`);
  return n;
};

/** Change the price, description and visibility of a catalogue product. */
export async function updateProduct(productId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const price = Number(formData.get("basePriceKes"));
  if (!Number.isInteger(price) || price < 0) throw new Error("Enter the price in whole KES");
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 300);
  const active = formData.get("active") === "on";

  // what each material, colour and size adds, and what an extra generation costs
  const row = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { options: true } });
  const options = structuredClone((row.options ?? {}) as ProductOptions) as ProductOptions;
  for (const g of VARIANT_GROUPS) {
    for (const c of options[g.list] ?? []) {
      const v = formData.get(`add:${g.list}:${c.key}`);
      if (v !== null) c.addKes = wholeKes(v, c.label);
    }
  }
  if (options.generations) {
    const inc = formData.get("gen:included");
    const per = formData.get("gen:perExtra");
    if (inc !== null) options.generations.included = Math.min(Math.max(wholeKes(inc, "Generations included"), 1), 4);
    if (per !== null) options.generations.perExtraKes = wholeKes(per, "Price per extra generation");
  }

  await db.product.update({
    where: { id: productId },
    data: { basePriceKes: price, active, options: options as object, priceReviewedAt: new Date(), ...(summary ? { summary } : {}) },
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
  revalidatePath("/shop");
  revalidatePath("/");
}
