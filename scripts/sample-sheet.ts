// Render a sample print sheet to PNG for eyeballing: tsx scripts/sample-sheet.ts out.png
import sharp from "sharp";
import { renderPrintSheet } from "../src/lib/print-sheet";

const out = process.argv[2] ?? "sample-sheet.png";
const r = await renderPrintSheet(
  {
    productName: "Memorial tile plaque with QR",
    qrUrl: "https://myroots.laitor.co.ke/q/uhxc874p",
    pathway: "REMEMBERED",
    options: {
      first: "John",
      surname: "Kamau",
      birth: "12 March 1948",
      death: "2026",
      epitaph: "A good man, a good father",
      parents: "Peter Kamau\nMary Wanjiku",
      spouse: "Grace Kamau",
      children: "Ann Kamau\nJames Kamau",
      siblings: "Paul Kamau",
    },
  },
  "standard",
);
await sharp(Buffer.from(r.svg)).resize({ width: 800 }).png().toFile(out);
console.log(out, r.warnings);
