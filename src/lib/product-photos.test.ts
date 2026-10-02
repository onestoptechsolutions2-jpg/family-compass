import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { cardPhoto, processPhoto } from "./product-photos";
import { photosForVariants } from "./product-photo-selection";

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#884422" } }).png().toBuffer();

describe("an uploaded product photo", () => {
  it("is re-encoded as a web picture and given a small copy", async () => {
    const r = await processPhoto(await png(2400, 1800), "image/png");
    expect(r.mimeType).toBe("image/webp");
    const big = await sharp(r.bytes).metadata();
    const small = await sharp(r.thumb).metadata();
    expect(big.format).toBe("webp");
    expect(big.width).toBe(1600);
    expect(small.width).toBe(720);
    expect(small.height).toBe(540);
  });

  it("is refused when it is not a picture, whatever the browser says", async () => {
    await expect(processPhoto(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"), "image/png")).rejects.toThrow(/not a photo/);
    await expect(processPhoto(Buffer.from("hello"), "image/jpeg")).rejects.toThrow(/not a photo/);
  });

  it("is refused when the type is not allowed", async () => {
    await expect(processPhoto(await png(800, 600), "image/svg+xml")).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(processPhoto(await png(800, 600), "application/pdf")).rejects.toThrow(/JPEG, PNG or WebP/);
  });

  it("is refused when it is too small or too large", async () => {
    await expect(processPhoto(await png(200, 150), "image/png")).rejects.toThrow(/too small/);
    await expect(processPhoto(Buffer.alloc(9 * 1024 * 1024), "image/png")).rejects.toThrow(/too large/);
  });
});

describe("the small picture for a card", () => {
  it("uses an uploaded photo's thumbnail", () => {
    expect(cardPhoto([{ src: "/api/product-image/abc", alt: "x" }], "p").src).toBe("/api/product-image/abc?size=thumb");
  });
  it("uses our own photo's small copy", () => {
    expect(cardPhoto([{ src: "/samples/granite-tombstone-tree-deceased-focus.jpg", alt: "x" }], "tombstone-family-tree").src).toContain("thumb-");
  });
  it("leaves a drawn example as it is", () => {
    expect(cardPhoto([{ src: "/api/sample/desk-family-tree?v=1", alt: "x" }], "desk-family-tree").src).toBe("/api/sample/desk-family-tree?v=1");
  });
});

describe("variant product photos", () => {
  const photos = [
    { src: "oak", alt: "Oak finish", variantKey: "finishKey", variantValue: "oak" },
    { src: "black", alt: "Black finish", variantKey: "finishKey", variantValue: "black" },
    { src: "general", alt: "All finishes" },
  ];

  it("shows matching variant photos before product-wide photos", () => {
    expect(photosForVariants(photos, { finishKey: "black" }).map((photo) => photo.src)).toEqual(["black", "general"]);
  });

  it("keeps general product photos when there is no matching variant photo", () => {
    expect(photosForVariants(photos, { finishKey: "white" }).map((photo) => photo.src)).toEqual(["general"]);
  });
});
