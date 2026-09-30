// Render the tappable builder for eyeballing: tsx scripts/sample-builder.ts <outdir>
import sharp from "sharp";
import { renderPrintSheet } from "../src/lib/print-sheet";
import type { DraftOptions } from "../src/lib/order-shared";

const dir = process.argv[2] ?? ".";
const cases: [string, DraftOptions, string, "LIVING" | "REMEMBERED"][] = [
  ["empty", { first: "", surname: "" }, "wall", "LIVING"],
  ["half", { first: "Ann", surname: "Kamau", parents: "\nMary Wanjiku", motherParents: "\nNjeri", children: "Lucy\nBen", spouse: "Tom Otieno" }, "wall", "LIVING"],
  ["remembered", { first: "John", surname: "Kamau", birth: "1948", death: "2026", parents: "Peter Kamau\nMary Wanjiku", children: "Ann Kamau" }, "square", "REMEMBERED"],
];
for (const [name, options, size, pathway] of cases) {
  const r = await renderPrintSheet(
    { productName: name, qrUrl: "https://myroots.laitor.co.ke/q/example", pathway, layout: "tree", options: { ...options, materialKey: pathway === "LIVING" ? "wood" : "granite" }, interactive: true },
    size,
  );
  await sharp(Buffer.from(r.svg)).resize({ width: 1200 }).png().toFile(`${dir}/builder-${name}.png`);
  console.log(name, (r.svg.match(/data-slot=/g) ?? []).length, "tappable places,", (r.svg.match(/tb-ghost/g) ?? []).length, "empty");
}
