import sharp from "sharp";

import { db } from "@/lib/db";
import { PRODUCT_IMAGES, productThumb } from "@/lib/product-images";
import type { ProductPhoto } from "@/lib/product-photo-selection";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_PER_PRODUCT = 8;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type Shown = ProductPhoto;

/** Make an uploaded picture safe and small: re-encoded (so nothing hidden rides along), turned upright, sized for the web. */
export async function processPhoto(input: Buffer, mimeType: string): Promise<{ bytes: Buffer; thumb: Buffer; mimeType: string }> {
  if (!ALLOWED.has(mimeType)) throw new Error("Use a JPEG, PNG or WebP photo.");
  if (input.length > MAX_PHOTO_BYTES) throw new Error("That photo is too large. Keep it under 8 MB.");
  // the bytes decide what it is, not the name the browser gave it
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta || !["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error("That file is not a photo we can use.");
  if ((meta.width ?? 0) < 400 || (meta.height ?? 0) < 300) throw new Error("That photo is too small. Use one at least 400 x 300 pixels.");
  const base = sharp(input, { limitInputPixels: 80_000_000 }).rotate();
  const bytes = await base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await base.clone().resize({ width: 720, height: 540, fit: "cover" }).webp({ quality: 76 }).toBuffer();
  return { bytes, thumb, mimeType: "image/webp" };
}

/** Where a stored photo is served from. The id never changes its picture, so it can be kept forever. */
export const photoUrl = (id: string, thumb = false) => `/api/product-image/${id}${thumb ? "?size=thumb" : ""}`;

/**
 * What to show for a product, best first: photos an admin uploaded, then the finished-product
 * photos we already hold, then a drawn example on a generic scene.
 */
export async function photosFor(
  products: { id: string; slug: string; name: string; updatedAt: Date }[],
  includeVariants = false,
): Promise<Map<string, Shown[]>> {
  const rows = products.length
    ? await db.productImage.findMany({
        where: { productId: { in: products.map((p) => p.id) }, ...(includeVariants ? {} : { variantKey: null }) },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, productId: true, alt: true, variantKey: true, variantValue: true },
      })
    : [];
  const out = new Map<string, Shown[]>();
  for (const p of products) {
    const uploaded = rows.filter((r) => r.productId === p.id).map((r) => ({
      id: r.id,
      alt: r.alt || p.name,
      variantKey: r.variantKey,
      variantValue: r.variantValue,
    }));
    const hasGeneralPhoto = uploaded.some((r) => !r.variantKey || !r.variantValue) || (PRODUCT_IMAGES[p.slug]?.length ?? 0) > 0;
    out.set(p.id, [
      ...uploaded.map((r) => ({
        src: photoUrl(r.id),
        alt: r.alt,
        ...(r.variantKey && r.variantValue ? { variantKey: r.variantKey, variantValue: r.variantValue } : {}),
      })),
      ...(PRODUCT_IMAGES[p.slug] ?? []),
      ...(!hasGeneralPhoto ? [{ src: `/api/sample/${p.slug}?v=${p.updatedAt.getTime()}`, alt: `Example of the ${p.name}` }] : []),
    ]);
  }
  return out;
}

/** The small picture for a card: an uploaded photo's thumbnail, our own photo's thumbnail, else the drawn example. */
export function cardPhoto(shown: Shown[], slug: string): Shown {
  const first = shown[0]!;
  if (first.src.startsWith("/api/product-image/")) return { ...first, src: `${first.src}?size=thumb` };
  if (first.src.startsWith("/samples/")) return productThumb(slug) ?? first;
  return first;
}
