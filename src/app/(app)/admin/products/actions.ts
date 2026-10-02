"use server";

import { revalidatePath } from "next/cache";
import { ProductPathway } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { MAX_PHOTOS_PER_PRODUCT, processPhoto } from "@/lib/product-photos";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { isLayout } from "@/lib/layouts";
import { slugify } from "@/lib/slug";

const wholeKes = (v: FormDataEntryValue | null, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw new Error(`${what}: enter a whole number of KES`);
  return n;
};

function choicesFromForm(value: FormDataEntryValue | null, groupTitle: string) {
  const rows = String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length > 30) throw new Error(`${groupTitle}: keep to 30 choices or fewer`);
  const seen = new Set<string>();
  return rows.map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    const [key = "", label = "", price = ""] = parts;
    if (parts.length !== 3 || !/^[a-z0-9_-]{1,40}$/.test(key) || !label || label.length > 100 || price === "") {
      throw new Error(`${groupTitle}: use key|label|price on each line`);
    }
    if (seen.has(key)) throw new Error(`${groupTitle}: choice keys must be unique`);
    seen.add(key);
    return { key, label, addKes: wholeKes(price, label) };
  });
}

/** Create an off-sale product draft; admins set quoted pricing before launch. */
export async function createProductDraft(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 300);
  const group = String(formData.get("group") ?? "").trim().slice(0, 60);
  const pathway = String(formData.get("pathway") ?? "");
  const layout = String(formData.get("layout") ?? "");
  const aisle = String(formData.get("aisle") ?? "");
  const shipVia = String(formData.get("shipVia") ?? "direct");
  const skills = [...new Set(String(formData.get("skills") ?? "").split(",").map((skill) => skill.trim()).filter(Boolean))];
  if (name.length < 3 || !slug || !summary || !group) throw new Error("Enter a product name, group and description.");
  if (!Object.values(ProductPathway).includes(pathway as ProductPathway)) throw new Error("Choose a valid product pathway.");
  if (!isLayout(layout)) throw new Error("Choose a supported product layout.");
  if (!["memorial_stone", "wall_art", "books_print", "events_merch"].includes(aisle)) throw new Error("Choose a valid shop aisle.");
  if (shipVia !== "direct" && shipVia !== "via_us") throw new Error("Choose a valid delivery route.");
  if (skills.length > 6 || skills.some((skill) => !/^[a-z0-9_-]{2,40}$/.test(skill))) throw new Error("Enter up to six valid maker skills, separated by commas.");
  if (await db.product.findUnique({ where: { slug }, select: { id: true } })) throw new Error("That product URL already exists. Choose another slug.");

  const last = await db.product.findFirst({ where: { aisle }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const product = await db.product.create({
    data: {
      name,
      slug,
      summary,
      group,
      pathway: pathway as ProductPathway,
      layout,
      aisle,
      shipVia,
      skills,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      basePriceKes: 0,
      active: false,
      options: { materials: [], finishes: [], sizes: [] },
    },
    select: { id: true, slug: true },
  });
  await writeAudit({ actorId: admin.id, action: "product.create_draft", targetType: "product", targetId: product.id, meta: { slug: product.slug, layout, aisle } });
  revalidateShop();
}

/** Change the price, description and visibility of a catalogue product. */
export async function updateProduct(productId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const price = Number(formData.get("basePriceKes"));
  if (!Number.isInteger(price) || price < 0) throw new Error("Enter the price in whole KES");
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 300);
  const active = formData.get("active") === "on";
  if (active && price < 1) throw new Error("Set a real price before putting a product on sale");

  // what each material, colour and size adds, and what an extra generation costs
  const row = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { options: true } });
  const options = structuredClone((row.options ?? {}) as ProductOptions) as ProductOptions;
  for (const g of VARIANT_GROUPS) {
    const choices = formData.get(`choices:${g.list}`);
    if (choices !== null) options[g.list] = choicesFromForm(choices, g.title);
  }
  if (options.generations) {
    const inc = formData.get("gen:included");
    const per = formData.get("gen:perExtra");
    if (inc !== null) options.generations.included = Math.min(Math.max(wholeKes(inc, "Generations included"), 1), 4);
    if (per !== null) options.generations.perExtraKes = wholeKes(per, "Price per extra generation");
  }

  await db.product.update({
    where: { id: productId },
    data: {
      basePriceKes: price,
      active,
      options: options as object,
      priceReviewedAt: price > 0 ? new Date() : null,
      ...(summary ? { summary } : {}),
    },
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
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { options: true } });
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a photo to upload.");
  const count = await db.productImage.count({ where: { productId } });
  if (count >= MAX_PHOTOS_PER_PRODUCT) throw new Error(`A product can have up to ${MAX_PHOTOS_PER_PRODUCT} photos. Remove one first.`);
  const variant = String(formData.get("variant") ?? "");
  let variantKey: string | null = null;
  let variantValue: string | null = null;
  if (variant) {
    const [key, value] = variant.split("=");
    const group = VARIANT_GROUPS.find((choiceGroup) => choiceGroup.key === key);
    const offered = group && (((product.options ?? {}) as ProductOptions)[group.list] ?? []).some((choice) => choice.key === value);
    if (!group || !value || !offered) throw new Error("Choose a variant this product offers.");
    variantKey = group.key;
    variantValue = value;
  }
  const { bytes, thumb, mimeType } = await processPhoto(Buffer.from(await file.arrayBuffer()), file.type);
  const last = await db.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const img = await db.productImage.create({
    data: {
      productId,
      variantKey,
      variantValue,
      bytes: new Uint8Array(bytes),
      thumb: new Uint8Array(thumb),
      mimeType,
      alt: String(formData.get("alt") ?? "").trim().slice(0, 200),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      uploadedById: admin.id,
    },
    select: { id: true },
  });
  await writeAudit({ actorId: admin.id, action: "product.photo_add", targetType: "product", targetId: productId, meta: { imageId: img.id, variantKey, variantValue } });
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
