// How the builder reads at phone width (360 px), for different sheet shapes.
//   tsx scripts/sample-phone.ts <outdir>
import sharp from "sharp";
import { renderPrintSheet } from "../src/lib/print-sheet";

const dir = process.argv[2] ?? ".";
const options = { first: "Ann", surname: "Kamau", parents: "Peter Kamau\nMary Wanjiku", fatherParents: "Old Kamau", children: "Lucy\nBen", spouse: "Tom Otieno", materialKey: "wood" };
for (const size of ["wall", "square", "standard", "a2"]) {
  const r = await renderPrintSheet({ productName: "x", qrUrl: "https://x.co/q/e", pathway: "LIVING", layout: "tree", options, interactive: true }, size);
  await sharp(Buffer.from(r.svg)).resize({ width: 360 }).png().toFile(`${dir}/phone-${size}.png`);
  console.log(size, `${r.widthMm}x${r.heightMm}`);
}
