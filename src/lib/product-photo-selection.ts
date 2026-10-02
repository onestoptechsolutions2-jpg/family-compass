export type ProductPhoto = { src: string; alt: string; variantKey?: string; variantValue?: string };
export type VariantSelection = Record<string, string | undefined>;

export function photosForVariants(photos: ProductPhoto[], selected: VariantSelection): ProductPhoto[] {
  const matching = photos.filter((photo) =>
    photo.variantKey && photo.variantValue ? selected[photo.variantKey] === photo.variantValue : false,
  );
  return [...matching, ...photos.filter((photo) => !photo.variantKey || !photo.variantValue)];
}