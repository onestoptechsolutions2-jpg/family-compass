import { describe, expect, it } from "vitest";

import { generationsOf, priceBreakdown, priceRange, type ProductOptions } from "./product-pricing";
import { skinFor } from "./print-kit";

const po: ProductOptions = {
  materials: [{ key: "wood", label: "Solid wood", addKes: 0 }],
  finishes: [
    { key: "light", label: "Light oak", addKes: 0 },
    { key: "dark", label: "Dark walnut", addKes: 1500 },
  ],
  sizes: [
    { key: "standard", label: "Desk", addKes: 0 },
    { key: "wall", label: "Wall", addKes: 6000 },
  ],
  generations: { included: 2, perExtraKes: 2000 },
};

describe("how many generations a piece shows", () => {
  it("counts the person alone as one", () => {
    expect(generationsOf("tree", { first: "Ann" })).toBe(1);
  });
  it("adds parents, grandparents and children", () => {
    expect(generationsOf("tree", { first: "Ann", parents: "Peter\nMary" })).toBe(2);
    expect(generationsOf("tree", { first: "Ann", parents: "Peter", fatherParents: "Omukoko" })).toBe(3);
    expect(generationsOf("tree", { first: "Ann", parents: "Peter", fatherParents: "Omukoko", children: "Lucy" })).toBe(4);
  });
  it("counts a mother alone as a parent generation, and ignores blank lines", () => {
    expect(generationsOf("tree", { parents: "\nMary" })).toBe(2);
    expect(generationsOf("tree", { parents: "\n\n  " })).toBe(1);
  });
  it("is the same for a banner, and starts at two for a wedding", () => {
    expect(generationsOf("banner", { parents: "Peter" })).toBe(2);
    expect(generationsOf("wedding", {})).toBe(2);
    expect(generationsOf("wedding", { children: "Lucy" })).toBe(3);
  });
  it("does not apply to pieces that are not family trees", () => {
    for (const l of ["card", "calendar", "badges", "shirt"]) expect(generationsOf(l, { parents: "Peter" })).toBeNull();
  });
});

describe("the price of a piece", () => {
  it("is the base when nothing costs extra", () => {
    const p = priceBreakdown(15000, po, "tree", { materialKey: "wood", finishKey: "light", sizeKey: "standard", parents: "Peter\nMary" });
    expect(p.total).toBe(15000);
    expect(p.adds).toEqual([]);
  });
  it("adds the finish and the size chosen", () => {
    const p = priceBreakdown(15000, po, "tree", { finishKey: "dark", sizeKey: "wall" });
    expect(p.total).toBe(15000 + 1500 + 6000);
    expect(p.adds.map((a) => a.label)).toEqual(["Dark walnut", "Wall"]);
  });
  it("adds each generation beyond those included", () => {
    const three = priceBreakdown(15000, po, "tree", { parents: "Peter", fatherParents: "Omukoko" });
    expect(three.generations).toBe(3);
    expect(three.total).toBe(17000);
    expect(three.adds.at(-1)).toEqual({ label: "1 extra generation", kes: 2000 });
    const four = priceBreakdown(15000, po, "tree", { parents: "Peter", fatherParents: "Omukoko", children: "Lucy" });
    expect(four.total).toBe(19000);
    expect(four.adds.at(-1)!.label).toBe("2 extra generations");
  });
  it("never charges less than the base for a small tree", () => {
    expect(priceBreakdown(15000, po, "tree", {}).total).toBe(15000);
  });
  it("ignores a choice the product does not offer", () => {
    expect(priceBreakdown(15000, po, "tree", { finishKey: "gold", sizeKey: "huge" }).total).toBe(15000);
  });
  it("charges nothing for generations on a product that is not priced that way", () => {
    const flat: ProductOptions = { sizes: po.sizes };
    expect(priceBreakdown(5000, flat, "tree", { parents: "a", fatherParents: "b", children: "c" }).total).toBe(5000);
    expect(priceBreakdown(5000, po, "card", { parents: "a", fatherParents: "b", children: "c" }).total).toBe(5000);
  });
  it("without a layout it prices only the choices, as before", () => {
    expect(priceBreakdown(30000, { sizes: [{ key: "large", label: "L", addKes: 7000 }] }, undefined, { sizeKey: "large" }).total).toBe(37000);
  });
});

describe("the range shown in the shop", () => {
  it("runs from the cheapest to the dearest way to buy it", () => {
    expect(priceRange(15000, po, "tree")).toEqual({ from: 15000, to: 15000 + 1500 + 6000 + 2 * 2000 });
  });
  it("is one price when there is nothing to choose", () => {
    expect(priceRange(3000, null, "badges")).toEqual({ from: 3000, to: 3000 });
  });
});

describe("colour and finish decide how the piece looks", () => {
  it("grey granite, dark walnut and cream paper", () => {
    expect(skinFor("granite", "grey")).toBe("slategrey");
    expect(skinFor("tile", "black")).toBe("slate");
    expect(skinFor("wood", "dark")).toBe("walnut");
    expect(skinFor("wood", "light")).toBe("wood");
    expect(skinFor("poster", "cream")).toBe("cream");
    expect(skinFor("poster", "oak")).toBe("paper");
  });
});
