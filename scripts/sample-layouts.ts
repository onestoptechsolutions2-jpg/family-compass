// Render one sample of every layout to PNG for eyeballing: tsx scripts/sample-layouts.ts <outdir>
import sharp from "sharp";
import { renderPrintSheet } from "../src/lib/print-sheet";
import type { Layout } from "../src/lib/layouts";
import type { DraftOptions } from "../src/lib/order-shared";

const dir = process.argv[2] ?? ".";
const qrUrl = "https://myroots.laitor.co.ke/q/uhxc874p";
const tree: DraftOptions = {
  first: "Hesbon Okusimba", surname: "Musungu", birth: "1948", death: "2026",
  parents: "Joseph Musungu\nSelpha Ndakala", fatherParents: "Omukoko Khamala\nRebecca Mukhuyu", motherParents: "William Shitseswa\nJane Mukoma",
  children: "Willy Okusimba\nBilly Okusimba\nJane Okusimba\nJames Okusimba\nShalle Okusimba",
};

const cases: [string, Layout, "LIVING" | "REMEMBERED", string, DraftOptions][] = [
  ["card", "card", "REMEMBERED", "pack50", { first: "John", surname: "Kamau", birth: "12 March 1948", death: "2026", epitaph: "Gone from our sight, never from our hearts. Rest well, Baba." }],
  ["calendar", "calendar", "LIVING", "a3", {
    surname: "Kamau", first: "Ann", year: "2027", title: "The Kamau Family",
    birthdays: "Ann Kamau, 3 March 1985\nPeter Kamau, 17 March 1950\nMary Wanjiku, 9 June 1955\nJames Kamau, 21 June 1988\nLucy Otieno, 14 February 2012\nBen Otieno, 30 August 2015\nTom Otieno, 1 December 1982\nGrace Kamau, 25 December 1953\nPaul Kamau, 12 October 1990\nWedding anniversary, 14 December",
  }],
  ["badges", "badges", "LIVING", "badges20", { title: "Kamau Family Reunion 2026", surname: "Kamau", first: "Peter", attendees: "Peter Kamau, Host\nMary Wanjiku, Aunt\nJames Kamau, Cousin\nAnn Kamau-Otieno, Niece\nBen Otieno, Nephew\nGrace Wanjiru Kamau, Grandmother" }],
  ["shirt", "shirt", "LIVING", "tee_m", { surname: "Kamau", title: "Family Reunion", year: "2026", place: "Kakamega" }],
  ["banner", "banner", "LIVING", "banner", { ...tree, death: "", title: "Musungu Family Reunion 2026", spouse: "Grace Musungu", siblings: "Paul Musungu", materialKey: "vinyl" }],
  ["wedding", "wedding", "LIVING", "wall", { first: "Ann", surname: "Kamau", spouse: "Tom Otieno", year: "14 December 2026", title: "The wedding of Ann and Tom", parents: "Peter Kamau\nMary Wanjiku", spouseParents: "David Otieno\nRuth Achieng", children: "", materialKey: "wood" }],
  ["wedding-a3", "wedding", "LIVING", "a3", { first: "Ann", surname: "Kamau", spouse: "Tom Otieno", year: "14 December 2026", title: "The wedding of Ann and Tom", parents: "Peter Kamau\nMary Wanjiku", spouseParents: "David Otieno\nRuth Achieng", materialKey: "poster" }],
  ["wedding-a2", "wedding", "LIVING", "a2", { first: "Ann", surname: "Kamau", spouse: "Tom Otieno", year: "14 December 2026", title: "The wedding of Ann and Tom", parents: "Peter Kamau\nMary Wanjiku", spouseParents: "David Otieno\nRuth Achieng", materialKey: "poster" }],
  ["memorial-desk", "tree", "REMEMBERED", "standard", { ...tree, materialKey: "wood" }],
  ["memorial-a1", "tree", "REMEMBERED", "a1", { ...tree, materialKey: "poster" }],
  ["desk-living", "tree", "LIVING", "standard", { ...tree, death: "", materialKey: "wood" }],
];

for (const [name, layout, pathway, size, options] of cases) {
  const r = await renderPrintSheet({ productName: name, qrUrl, pathway, layout, options }, size);
  const png = sharp(Buffer.from(r.svg)).resize({ width: 1300, withoutEnlargement: false }).flatten({ background: "#e8e8e8" });
  await png.png().toFile(`${dir}/layout-${name}.png`);
  console.log(name.padEnd(9), `${r.widthMm}x${r.heightMm}mm`, r.warnings.length ? r.warnings : "ok");
}
