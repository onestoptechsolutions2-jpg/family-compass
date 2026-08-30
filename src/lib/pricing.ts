import { GenerationKind, PaymentKind } from "@prisma/client";

export type BundleKind = "SINGLE" | "BUNDLE_5" | "BUNDLE_15";

/** Credit bundles. `SINGLE` price may be overridden by PaymentSettings.defaultPriceKes. */
export const BUNDLES: Record<
  BundleKind,
  { credits: number; priceKes: number; label: string; blurb: string }
> = {
  SINGLE: { credits: 1, priceKes: 750, label: "1 export", blurb: "one standard download" },
  BUNDLE_5: { credits: 5, priceKes: 2500, label: "5 exports", blurb: "KES 500 each" },
  BUNDLE_15: { credits: 15, priceKes: 6000, label: "15 exports", blurb: "KES 400 each" },
};

/** Annual per-tree subscription — unlimited downloads while active. */
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
  MEMORIAL_BOOK: "Memorial / eulogy book (PDF)",
  GEDCOM_EXPORT: "GEDCOM data export (.ged)",
  GRAMPS_EXPORT: "Gramps data export (.gramps)",
};

export const GENERATION_NEEDS_CENTRAL: Record<GenerationKind, boolean> = {
  PEDIGREE_PDF: true,
  FAN_CHART: true,
  DESCENDANT_CHART: true,
  FAMILY_BOOK: false,
  MEMORIAL_BOOK: true,
  GEDCOM_EXPORT: false,
  GRAMPS_EXPORT: false,
};

export function bundleForKind(kind: PaymentKind) {
  return kind === "SINGLE" || kind === "BUNDLE_5" || kind === "BUNDLE_15" ? BUNDLES[kind] : null;
}

// ---------------------------------------------------------------------------
// Size-based print pricing
// ---------------------------------------------------------------------------

export type PriceFactors = {
  defaultPriceKes: number;
  priceFreeGenerations: number;
  priceFreeNodes: number;
  pricePerGenerationKes: number;
  pricePerNodeKes: number;
};

export function computeGenerationPrice(
  baseKes: number,
  generations: number,
  nodeCount: number,
  f: PriceFactors,
): { priceKes: number; generationsSurcharge: number; nodesSurcharge: number } {
  const extraGens = Math.max(0, Math.ceil(generations) - f.priceFreeGenerations);
  const extraNodes = Math.max(0, nodeCount - f.priceFreeNodes);
  const generationsSurcharge = extraGens * f.pricePerGenerationKes;
  const nodesSurcharge = extraNodes * f.pricePerNodeKes;
  return {
    priceKes: Math.max(0, Math.round(baseKes + generationsSurcharge + nodesSurcharge)),
    generationsSurcharge,
    nodesSurcharge,
  };
}

/** How many KES-750-equivalent credits a priced generation costs. */
export function creditsForPrice(priceKes: number, creditValueKes: number): number {
  if (creditValueKes <= 0) return 1;
  return Math.max(1, Math.ceil(priceKes / creditValueKes));
}

// ---------------------------------------------------------------------------
// Research Partner quote
// ---------------------------------------------------------------------------

export function computeResearchQuote(
  generationsTarget: number | null | undefined,
  nodesTarget: number | null | undefined,
  s: { researchBaseKes: number; researchPerGenerationKes: number; researchPerNodeKes: number },
): number {
  return Math.round(
    s.researchBaseKes +
      (generationsTarget ?? 0) * s.researchPerGenerationKes +
      (nodesTarget ?? 0) * s.researchPerNodeKes,
  );
}
