import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { programmeBlocks, programmePages, renderProgramme } from "./print-programme";

const base = { productName: "Funeral programme", qrUrl: "https://myroots.laitor.co.ke/q/prog1234", pathway: "REMEMBERED" as const, layout: "programme" as const };
const person = { first: "Hesbon", surname: "Musungu", birth: "1948", death: "2026", serviceWhen: "Saturday 14 November 2026, 10am", venue: "Ematsuli" };

describe("funeral programme", () => {
  it("rounds the pages to a whole folded booklet", () => {
    expect(programmePages(undefined)).toBe(4);
    expect(programmePages("8")).toBe(8);
    expect(programmePages("10")).toBe(12);
    expect(programmePages("abc")).toBe(4);
  });

  it("reads times off the order of service and leaves out empty sections", () => {
    const b = programmeBlocks({ service: "9:00 Arrival of the body\nOpening prayer\n10.30am - Burial" });
    expect(b[0]).toEqual({ kind: "heading", text: "Order of service" });
    expect(b[1]).toEqual({ kind: "row", left: "9:00", right: "Arrival of the body" });
    expect(b[2]).toEqual({ kind: "item", text: "Opening prayer" });
    expect(b[3]).toEqual({ kind: "row", left: "10.30am", right: "Burial" });
    expect(b.some((x) => x.kind === "heading" && x.text === "Hymns")).toBe(false);
  });

  it("makes one page per page chosen, cover first and the QR on the back", async () => {
    const r = renderProgramme({ ...base, options: { ...person, pagesKey: "8", service: "9:00 Arrival", bio: "A teacher." } }, "a5");
    expect(r.pages).toHaveLength(8);
    expect(r.pageMm).toEqual([148, 210]);
    expect(r.pages![0]).toContain("Hesbon Musungu");
    const jsQR = (await import("jsqr")).default;
    const { data, info } = await sharp(Buffer.from(r.pages![7]!)).resize({ width: 900 }).flatten({ background: "#fff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(base.qrUrl);
  });

  it("says when it does not fit, and when fewer pages would do", () => {
    const long = renderProgramme({ ...base, options: { ...person, pagesKey: "4", bio: "Word ".repeat(3000) } }, "a5");
    expect(long.warnings.join(" ")).toMatch(/does not fit in 4 pages/);
    const short = renderProgramme({ ...base, options: { ...person, pagesKey: "16", service: "9:00 Arrival" } }, "a5");
    expect(short.warnings.join(" ")).toMatch(/4 pages would do/);
  });

  it("prints the photo when there is one, and asks for one when there is not", () => {
    const withPhoto = renderProgramme({ ...base, photoHref: "data:image/jpeg;base64,AAAA", options: person }, "a5");
    expect(withPhoto.pages![0]).toContain("data:image/jpeg;base64,AAAA");
    const without = renderProgramme({ ...base, options: person }, "a5");
    expect(without.warnings.join(" ")).toMatch(/No photo/);
  });

  it("scales up for A4", () => {
    expect(renderProgramme({ ...base, options: person }, "a4").pageMm).toEqual([210, 297]);
  });
});
