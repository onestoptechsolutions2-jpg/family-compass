import { GenerationKind, PaymentKind } from "@prisma/client";

/** Credit bundles a buyer can purchase. Single price may be overridden by
 *  PaymentSettings.defaultPriceKes. */
export const BUNDLES: Record<
  Exclude<PaymentKind, "KEEPER">,
  { credits: number; priceKes: number; label: string; blurb: string }
> = {
  SINGLE: { credits: 1, priceKes: 750, label: "1 export", blurb: "One print-ready download" },
  BUNDLE_5: { credits: 5, priceKes: 2500, label: "5 exports", blurb: "KES 500 each" },
  BUNDLE_15: { credits: 15, priceKes: 6000, label: "15 exports", blurb: "KES 400 each" },
};

/** Annual per-tree subscription — unlimited downloads while active.
 *  Price may be overridden by PaymentSettings.keeperPriceKes. */
export const KEEPER_PLAN = {
  defaultPriceKes: 3000,
  months: 12,
  label: "Family plan",
  blurb: "Unlimited downloads for one year",
};

export const GENERATION_LABELS: Record<GenerationKind, string> = {
  PEDIGREE_PDF: "Pedigree / ancestor chart (PDF)",
  FAN_CHART: "Fan chart (PDF + PNG)",
  DESCENDANT_CHART: "Descendant chart (PDF)",
  FAMILY_BOOK: "Family book (multi-page PDF)",
  GEDCOM_EXPORT: "GEDCOM data export (.ged)",
  GRAMPS_EXPORT: "Gramps data export (.gramps)",
};

export const GENERATION_NEEDS_CENTRAL: Record<GenerationKind, boolean> = {
  PEDIGREE_PDF: true,
  FAN_CHART: true,
  DESCENDANT_CHART: true,
  FAMILY_BOOK: false,
  GEDCOM_EXPORT: false,
  GRAMPS_EXPORT: false,
};

export function bundleForKind(kind: PaymentKind) {
  if (kind === PaymentKind.KEEPER) return null;
  return BUNDLES[kind];
}
