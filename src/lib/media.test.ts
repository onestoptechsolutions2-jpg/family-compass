import { describe, expect, it } from "vitest";

import { fileExt, buildMediaName } from "./media";

describe("fileExt", () => {
  it("prefers the original extension", () => {
    expect(fileExt("Wedding Photo.JPG", "image/jpeg")).toBe("jpg");
    expect(fileExt("scan.PDF", "application/pdf")).toBe("pdf");
  });
  it("falls back to the mime type", () => {
    expect(fileExt("blob", "image/png")).toBe("png");
    expect(fileExt("blob", "image/webp")).toBe("webp");
    expect(fileExt("blob", "image/jpeg")).toBe("jpg");
    expect(fileExt("blob", "application/octet-stream")).toBe("bin");
  });
});

describe("buildMediaName", () => {
  it("slugs owner + occasion and keeps a padded sequence + token", () => {
    const a = buildMediaName({ owner: "Sarah Khamala", occasion: "Wedding 1998", seq: 3, ext: "jpg" });
    expect(a.fileName).toMatch(/^sarah-khamala-wedding-1998-03-[a-z0-9]{5}\.jpg$/);
    expect(a.title).toBe("Sarah Khamala · Wedding 1998 · 3");
  });

  it("defaults the occasion to 'photo' and clamps seq to >= 1", () => {
    const a = buildMediaName({ owner: "John Doe", seq: 0, ext: "png" });
    expect(a.fileName).toMatch(/^john-doe-photo-01-[a-z0-9]{5}\.png$/);
    expect(a.title).toBe("John Doe · 1");
  });

  it("produces a different name each call (uniqueness)", () => {
    const opts = { owner: "X", occasion: "y", seq: 1, ext: "jpg" };
    expect(buildMediaName(opts).fileName).not.toBe(buildMediaName(opts).fileName);
  });
});
