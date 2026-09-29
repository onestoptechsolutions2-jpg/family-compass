import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/person-write", () => ({}));
vi.mock("@/lib/payments", () => ({}));
vi.mock("@/lib/workspace", () => ({}));

import { renderPrintSheet } from "./print-sheet";

const base = {
  productName: "Memorial tile plaque with QR",
  qrUrl: "https://myroots.laitor.co.ke/q/abcd1234",
  pathway: "REMEMBERED" as const,
};

describe("renderPrintSheet", () => {
  it("prints every name in full, in real millimetres, with a QR", async () => {
    const r = await renderPrintSheet(
      {
        ...base,
        options: {
          first: "John",
          surname: "Kamau",
          birth: "1948",
          death: "2026",
          epitaph: "Rest well",
          parents: "Peter Kamau\nMary Wanjiku",
          children: "Ann Kamau\nJames Kamau",
        },
      },
      "standard",
    );
    expect(r.widthMm).toBe(200);
    expect(r.heightMm).toBe(300);
    for (const n of ["John Kamau", "1948 – 2026", "Peter Kamau", "Mary Wanjiku", "Ann Kamau", "James Kamau", "Rest well"]) {
      expect(r.svg).toContain(n);
    }
    expect(r.svg).toContain("<path"); // the QR
    expect(r.svg).toContain("myroots.laitor.co.ke/q/abcd1234");
    expect(r.warnings).toEqual([]);
  });

  it("escapes markup in names", async () => {
    const r = await renderPrintSheet({ ...base, options: { first: "A<b>&", surname: "C" } }, "a2");
    expect(r.svg).not.toContain("<b>");
    expect(r.svg).toContain("A&lt;b&gt;&amp;");
    expect(r.widthMm).toBe(420);
  });

  it("warns instead of truncating when there are too many names", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `Person Number${i}`).join("\n");
    const r = await renderPrintSheet({ ...base, options: { first: "A", children: many } }, "standard");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.svg).toContain("Person Number24");
  });

  it("prints a QR that a phone can actually scan back to the right address", async () => {
    const sharp = (await import("sharp")).default;
    const jsQR = (await import("jsqr")).default;
    for (const [sizeKey, pathway] of [["standard", "REMEMBERED"], ["a2", "LIVING"], ["a1", "LIVING"]] as const) {
      const r = await renderPrintSheet(
        { ...base, pathway, options: { first: "John", surname: "Kamau", children: "Ann Kamau" } },
        sizeKey,
      );
      const { data, info } = await sharp(Buffer.from(r.svg))
        .resize({ width: 1200 })
        .flatten({ background: "#fff" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      expect(code?.data, `${sizeKey} ${pathway}`).toBe(base.qrUrl);
    }
  });

  it("warns when the name is missing", async () => {
    const r = await renderPrintSheet({ ...base, options: {} }, "standard");
    expect(r.warnings).toContain("The name is missing.");
  });
});
