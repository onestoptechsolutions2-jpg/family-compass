/** Finished-product photos (docs/commerce/samples), by product slug. */
const GRANITE = "/samples/granite-tombstone-tree-deceased-focus.jpg";
const WOOD_LIVING = "/samples/wooden-wall-tree-focus-living.jpg";
const WOOD_SPOUSE = "/samples/wooden-wall-tree-focus-spouse.jpg";

export const PRODUCT_IMAGES: Record<string, { src: string; alt: string }[]> = {
  "tile-plaque-qr": [{ src: GRANITE, alt: "Family tree engraved on a dark stone plaque with a QR code" }],
  "tombstone-family-tree": [{ src: GRANITE, alt: "Family tree engraved on a dark stone tombstone with a QR code" }],
  "wooden-family-tree": [
    { src: WOOD_LIVING, alt: "Family tree engraved in wood on a wall, with a QR code" },
    { src: WOOD_SPOUSE, alt: "Wooden family tree with the focus person and their spouse side by side" },
  ],
};

export const productImage = (slug: string) => PRODUCT_IMAGES[slug]?.[0];

/** Small versions for cards, so the landing page loads fast on a phone. */
const THUMB: Record<string, string> = {
  [GRANITE]: "/samples/thumb-granite-tombstone-tree-deceased-focus.jpg",
  [WOOD_LIVING]: "/samples/thumb-wooden-wall-tree-focus-living.jpg",
  [WOOD_SPOUSE]: "/samples/thumb-wooden-wall-tree-focus-spouse.jpg",
};
export const productThumb = (slug: string) => {
  const im = productImage(slug);
  return im ? { src: THUMB[im.src] ?? im.src, alt: im.alt } : undefined;
};
