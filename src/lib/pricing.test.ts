import { describe, expect, it } from "vitest";

import {
  computeGenerationPrice,
  creditsForPrice,
  computeResearchQuote,
  bundleForKind,
  BUNDLES,
} from "./pricing";

const factors = {
  defaultPriceKes: 750,
  priceFreeGenerations: 4,
  priceFreeNodes: 60,
  pricePerGenerationKes: 150,
  pricePerNodeKes: 8,
};

describe("computeGenerationPrice", () => {
  it("charges only the base within the free allowances", () => {
    expect(computeGenerationPrice(750, 4, 60, factors)).toMatchObject({
      priceKes: 750,
      generationsSurcharge: 0,
      nodesSurcharge: 0,
    });
  });

  it("adds a surcharge per extra generation and per extra node", () => {
    const r = computeGenerationPrice(750, 6, 100, factors);
    expect(r.generationsSurcharge).toBe(2 * 150);
    expect(r.nodesSurcharge).toBe(40 * 8);
    expect(r.priceKes).toBe(750 + 300 + 320);
  });

  it("rounds fractional generations up and never goes negative", () => {
    expect(computeGenerationPrice(0, 4.2, 0, factors).generationsSurcharge).toBe(150);
    expect(computeGenerationPrice(0, 1, 0, factors).priceKes).toBe(0);
  });
});

describe("creditsForPrice", () => {
  it("is at least one and rounds up", () => {
    expect(creditsForPrice(0, 750)).toBe(1);
    expect(creditsForPrice(750, 750)).toBe(1);
    expect(creditsForPrice(760, 750)).toBe(2);
    expect(creditsForPrice(2251, 750)).toBe(4);
  });
  it("falls back to one credit when the credit value is invalid", () => {
    expect(creditsForPrice(5000, 0)).toBe(1);
  });
});

describe("computeResearchQuote", () => {
  it("is base + per-generation + per-node, nulls treated as zero", () => {
    const s = { researchBaseKes: 5000, researchPerGenerationKes: 1500, researchPerNodeKes: 200 };
    expect(computeResearchQuote(3, 10, s)).toBe(5000 + 4500 + 2000);
    expect(computeResearchQuote(null, undefined, s)).toBe(5000);
  });
});

describe("bundles", () => {
  it("maps a PaymentKind to its bundle definition", () => {
    expect(bundleForKind("BUNDLE_5")).toEqual(BUNDLES.BUNDLE_5);
    expect(bundleForKind("KEEPER")).toBeNull();
  });
});
