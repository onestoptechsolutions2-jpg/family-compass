// Print a slice of a layout's SVG for debugging: tsx scripts/dump-svg.ts card 18700 18900
import { renderPrintSheet } from "../src/lib/print-sheet";
const [layout, from, to] = [process.argv[2] ?? "card", Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 400)];
const r = await renderPrintSheet(
  { productName: "x", qrUrl: "https://x.co/q/abc", pathway: "REMEMBERED", layout: layout as never, options: { first: "John", surname: "Kamau", birth: "1948", death: "2026", epitaph: "Rest well" } },
  layout === "card" ? "pack50" : undefined,
);
console.log(r.svg.slice(from, to));
