import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/person-write", () => ({}));
vi.mock("@/lib/payments", () => ({}));
vi.mock("@/lib/workspace", () => ({}));

import { renderPrintSheet, skinForMaterial, PRINT_BRAND } from "./print-sheet";

const base = {
  productName: "Tombstone family tree",
  qrUrl: "https://myroots.laitor.co.ke/q/abcd1234",
  pathway: "REMEMBERED" as const,
};

const family = {
  first: "Hesbon Okusimba",
  surname: "Musungu",
  birth: "1948",
  death: "2026",
  parents: "Joseph Musungu\nSelpha Ndakala",
  fatherParents: "Omukoko Khamala\nRebecca Mukhuyu",
  motherParents: "William Shitseswa\nJane Mukoma",
  spouse: "Grace Musungu",
  siblings: "Paul Musungu",
  children: "Willy Okusimba\nBilly Okusimba\nJane Okusimba\nJames Okusimba\nShalle Okusimba",
};

describe("renderPrintSheet", () => {
  it("lays out the whole family tree with every name, in real millimetres", async () => {
    const r = await renderPrintSheet({ ...base, options: { ...family, materialKey: "granite" } }, "square");
    expect(r.widthMm).toBe(400);
    expect(r.heightMm).toBe(400);
    for (const n of [
      "Hesbon", "Okusimba Musungu", "1948 – 2026", "Joseph Musungu", "Selpha Ndakala", "Omukoko", "Rebecca",
      "William", "Jane Mukoma", "Grace Musungu", "Paul Musungu", "Willy", "Shalle", "FOCUS", PRINT_BRAND.name,
      "SCAN TO VIEW THE", "FULL FAMILY TREE", "myroots.laitor.co.ke/q/abcd1234",
    ]) {
      expect(r.svg, n).toContain(n);
    }
    expect(r.svg).toContain("†"); // deceased focus
    expect(r.warnings).toEqual([]);
  });

  it("marks the deceased only on Remembered products", async () => {
    const living = await renderPrintSheet({ ...base, pathway: "LIVING", options: family }, "wall");
    expect(living.svg).not.toContain("†");
  });

  it("picks the skin from the material", () => {
    expect(skinForMaterial("granite")).toBe("slate");
    expect(skinForMaterial("tile")).toBe("slate");
    expect(skinForMaterial("wood")).toBe("wood");
    expect(skinForMaterial("poster")).toBe("paper");
    expect(skinForMaterial(undefined)).toBe("paper");
  });

  it("escapes markup in names", async () => {
    const r = await renderPrintSheet({ ...base, options: { first: "A<b>&", surname: "C" } }, "a2");
    expect(r.svg).not.toContain("<b>");
    expect(r.svg).toContain("A&lt;b&gt;&amp;");
    expect(r.widthMm).toBe(420);
  });

  it("never drops a name when there are many: it warns instead", async () => {
    const many = Array.from({ length: 30 }, (_, i) => `Person Number${i}`).join("\n");
    const r = await renderPrintSheet({ ...base, options: { first: "A", children: many } }, "standard");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.svg).toContain("Number29");
  });

  it("wraps a long name instead of cutting it", async () => {
    const r = await renderPrintSheet(
      { ...base, options: { first: "Hesbon", surname: "Musungu", children: "Christopher Wanyonyi Okusimba Junior" } },
      "square",
    );
    // full name survives, split over lines
    expect(r.svg).toMatch(/Christopher/);
    expect(r.svg).toMatch(/Junior/);
    expect(r.svg).not.toContain("…");
  });

  it("warns when grandparents are given without their child", async () => {
    const r = await renderPrintSheet({ ...base, options: { first: "A", fatherParents: "X Y\nZ W" } }, "square");
    expect(r.warnings.join(" ")).toContain("Grandparents");
  });

  it("warns when the name is missing", async () => {
    const r = await renderPrintSheet({ ...base, options: {} }, "standard");
    expect(r.warnings).toContain("The name is missing.");
  });

  it("prints a QR a phone can scan back to the right address, in every skin and size", async () => {
    const sharp = (await import("sharp")).default;
    const jsQR = (await import("jsqr")).default;
    const cases = [
      ["standard", "tile"],
      ["square", "granite"],
      ["wall", "wood"],
      ["a2", "poster"],
      ["a1", "poster"],
    ] as const;
    for (const [sizeKey, materialKey] of cases) {
      const r = await renderPrintSheet(
        { ...base, options: { ...family, materialKey } },
        sizeKey,
      );
      const { data, info } = await sharp(Buffer.from(r.svg))
        .resize({ width: 1600 })
        .flatten({ background: "#fff" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      expect(code?.data, `${sizeKey} ${materialKey}`).toBe(base.qrUrl);
    }
  }, 30_000); // five full-size renders; slow when the whole suite runs in parallel
});
