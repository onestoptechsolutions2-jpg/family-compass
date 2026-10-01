"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { MAX_PHOTOS_PER_PRODUCT, processPhoto } from "@/lib/product-photos";
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

/** Add a photo to a product. It is re-encoded and resized; the first one becomes the main photo. */
export async function uploadPhoto(productId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a photo to upload.");
  const count = await db.productImage.count({ where: { productId } });
  if (count >= MAX_PHOTOS_PER_PRODUCT) throw new Error(`A product can have up to ${MAX_PHOTOS_PER_PRODUCT} photos. Remove one first.`);
  const { bytes, thumb, mimeType } = await processPhoto(Buffer.from(await file.arrayBuffer()), file.type);
  const last = await db.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const img = await db.productImage.create({
    data: {
      productId,
      bytes: new Uint8Array(bytes),
      thumb: new Uint8Array(thumb),
      mimeType,
      alt: String(formData.get("alt") ?? "").trim().slice(0, 200),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      uploadedById: admin.id,
    },
    select: { id: true },
  });
  await writeAudit({ actorId: admin.id, action: "product.photo_add", targetType: "product", targetId: productId, meta: { imageId: img.id } });
  revalidateShop();
}

export async function deletePhoto(imageId: string) {
  const admin = await requirePlatformAdmin();
  const img = await db.productImage.delete({ where: { id: imageId }, select: { productId: true } });
  await writeAudit({ actorId: admin.id, action: "product.photo_remove", targetType: "product", targetId: img.productId, meta: { imageId } });
  revalidateShop();
}

/** Make a photo the main one, the first the shop shows. */
export async function makeMainPhoto(imageId: string) {
  const admin = await requirePlatformAdmin();
  const img = await db.productImage.findUniqueOrThrow({ where: { id: imageId }, select: { productId: true } });
  const first = await db.productImage.findFirst({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" }, select: { sortOrder: true } });
  await db.productImage.update({ where: { id: imageId }, data: { sortOrder: (first?.sortOrder ?? 0) - 1 } });
  await writeAudit({ actorId: admin.id, action: "product.photo_main", targetType: "product", targetId: img.productId, meta: { imageId } });
  revalidateShop();
}

function revalidateShop() {
  for (const path of ["/admin/products", "/shop", "/"]) revalidatePath(path);
  revalidatePath("/shop/[slug]", "page");
}
