// Render sample print sheets to PNG for eyeballing:
//   tsx scripts/sample-sheet.ts <outdir>
// Uses the family from docs/commerce/samples (deceased focus, granite).
import sharp from "sharp";
import { renderPrintSheet, type Skin } from "../src/lib/print-sheet";

const dir = process.argv[2] ?? ".";
const options = {
  first: "Hesbon Okusimba",
  surname: "Musungu",
  birth: "1948",
  death: "2026",
  parents: "Joseph Musungu\nSelpha Ndakala",
  fatherParents: "Omukoko Khamala\nRebecca Mukhuyu",
  motherParents: "William Shitseswa\nJane Mukoma",
  spouse: "",
  children: "Willy Okusimba\nBilly Okusimba\nJane Okusimba\nJames Okusimba\nShalle Okusimba",
};

const cases: [string, string, Skin, string, typeof options][] = [
  ["slate-square", "square", "slate", "REMEMBERED", options],
  ["wood-wall", "wall", "wood", "REMEMBERED", options],
  ["paper-a2", "a2", "paper", "LIVING", { ...options, spouse: "Grace Musungu", siblings: "Paul Musungu" } as typeof options],
];
for (const [name, size, skin, pathway, o] of cases) {
  const r = await renderPrintSheet(
    { productName: "sample", qrUrl: "https://myroots.laitor.co.ke/q/uhxc874p", pathway: pathway as "LIVING" | "REMEMBERED", options: o },
    size,
    skin,
  );
  await sharp(Buffer.from(r.svg)).resize({ width: 1200 }).png().toFile(`${dir}/${name}.png`);
  console.log(name, r.widthMm + "x" + r.heightMm, r.warnings);
}
