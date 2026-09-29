import QRCode from "qrcode";

import { lines, type DraftOptions } from "@/lib/orders";

/** Physical sizes in mm, keyed by the size options seeded on products. */
const SIZES_MM: Record<string, [number, number]> = {
  standard: [200, 300],
  a2: [420, 594],
  a1: [594, 841],
};

export type PrintInput = {
  options: DraftOptions;
  productName: string;
  qrUrl: string;
  /** "REMEMBERED" shows a cross before the dates; "LIVING" shows the title line. */
  pathway: "LIVING" | "REMEMBERED";
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The QR as vector squares, so it prints sharp at any size. */
function qrPath(text: string, x: number, y: number, size: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        d += `M${(x + c * cell).toFixed(3)} ${(y + r * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h${(-cell).toFixed(3)}z`;
      }
    }
  }
  return `<path d="${d}" fill="#000"/>`;
}

/**
 * A proof/print sheet for one order item, as SVG in real millimetres. Names are
 * never truncated: text shrinks to fit, and anything too dense is reported in
 * `warnings` so it can be fixed with the customer before production.
 */
export async function renderPrintSheet(input: PrintInput, sizeKey: string | undefined): Promise<{
  svg: string;
  widthMm: number;
  heightMm: number;
  warnings: string[];
}> {
  const [W, H] = SIZES_MM[sizeKey ?? "standard"] ?? SIZES_MM.standard!;
  const o = input.options;
  const warnings: string[] = [];
  const u = W / 100; // 1 unit = 1% of the width
  const name = [o.first, o.surname].filter(Boolean).join(" ") || "Name missing";
  if (!o.first) warnings.push("The name is missing.");

  const out: string[] = [];
  const text = (x: number, y: number, size: number, body: string, extra = "") =>
    out.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" ${extra}>${esc(body)}</text>`);

  // Fit a line of text inside 88% of the width without cutting it off.
  const fit = (body: string, maxSize: number, widthFrac = 0.88) =>
    Math.min(maxSize, (W * widthFrac) / Math.max(body.length * 0.55, 1));

  let y = H * 0.1;
  if (input.pathway === "LIVING" && o.epitaph) {
    text(W / 2, y, fit(o.epitaph, 6 * u), o.epitaph, 'font-style="italic"');
    y += H * 0.06;
  }
  const nameSize = fit(name, 9 * u);
  text(W / 2, y, nameSize, name, 'font-weight="700"');
  y += nameSize * 1.1;

  const dates = [o.birth, o.death].filter(Boolean).join(" – ");
  if (dates) {
    const label = input.pathway === "REMEMBERED" && o.death ? `${dates}` : dates;
    text(W / 2, y, fit(label, 4.5 * u), label);
    y += H * 0.05;
  }
  if (input.pathway === "REMEMBERED" && o.epitaph) {
    text(W / 2, y, fit(o.epitaph, 3.6 * u), `“${o.epitaph}”`, 'font-style="italic"');
    y += H * 0.06;
  }

  // Family blocks in reading order, each a heading and its names.
  const blocks: [string, string[]][] = [
    ["Parents", lines(o.parents)],
    ["Spouse", lines(o.spouse)],
    ["Children", lines(o.children)],
    ["Brothers and sisters", lines(o.siblings)],
  ];
  const shown = blocks.filter(([, names]) => names.length);
  const total = shown.reduce((n, [, names]) => n + names.length, 0);
  if (total > 20) warnings.push(`${total} names is above the 20 the layout is proven for; check legibility.`);

  const qrSize = Math.min(W * 0.28, H * 0.16);
  const bottom = H - qrSize - H * 0.09;
  const rows = shown.reduce((n, [, names]) => n + names.length + 1.6, 0);
  const avail = Math.max(bottom - y, 1);
  const lh = Math.min(avail / Math.max(rows, 1), 4.2 * u);
  const fs = lh * 0.72;
  if (fs < 2.2 * u) warnings.push("Names would print smaller than 2% of the width; reduce names or choose a larger size.");
  for (const [heading, names] of shown) {
    text(W / 2, y, fs * 0.8, heading.toUpperCase(), 'fill="#666" letter-spacing="0.4"');
    y += lh * 1.1;
    for (const n of names) {
      text(W / 2, y, Math.min(fs, fit(n, fs, 0.8)), n);
      y += lh;
    }
    y += lh * 0.5;
  }

  const qx = (W - qrSize) / 2;
  const qy = H - qrSize - H * 0.05;
  out.push(`<rect x="${qx - u}" y="${qy - u}" width="${qrSize + 2 * u}" height="${qrSize + 2 * u}" fill="#fff"/>`);
  out.push(qrPath(input.qrUrl, qx, qy, qrSize));
  text(W / 2, H - H * 0.015, 1.8 * u, input.qrUrl.replace(/^https?:\/\//, ""), 'fill="#444"');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" ` +
    `font-family="Georgia, 'Times New Roman', serif" fill="#111">` +
    `<rect width="${W}" height="${H}" fill="#fff"/>` +
    out.join("") +
    `</svg>`;
  return { svg, widthMm: W, heightMm: H, warnings };
}
