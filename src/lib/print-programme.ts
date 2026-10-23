import { lines, pair } from "@/lib/order-shared";
import { PRINT_BRAND, compass, esc, fitSize, qrPath, wrapText, type PrintInput, type PrintSheet } from "@/lib/print-kit";

/**
 * A funeral programme: a folded booklet of A5 (or A4) pages, in reading order.
 *
 *   page 1        the cover: "Celebrating the life of", the photo, the name, the dates, the service
 *   pages 2..n-1  order of service, their life, family, hymns, thanks, flowing page to page
 *   page n        the back: the QR to their memorial page, contributions, thanks, the brand
 *
 * The number of pages is a variant the customer chooses (pagesKey). What does not fit is
 * reported in `warnings`, never cut off silently. `pages` holds each page on its own for the
 * printer's PDF; `svg` lays them out two to a row for the preview.
 */

const PAGE_MM: Record<string, [number, number]> = { a5: [148, 210], a4: [210, 297] };
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/** Ink for full colour and for black and white. */
const INK = {
  colour: { text: "#1f1a24", sub: "#5b5163", accent: "#4b2e5a", gold: "#a8834a", band: "#f3eee6", paper: "#fffdf9" },
  mono: { text: "#111111", sub: "#4a4a4a", accent: "#222222", gold: "#555555", band: "#efefef", paper: "#ffffff" },
};

export const PROGRAMME_PAGE_CHOICES = [4, 8, 12, 16, 20, 24];

/** The pages the customer chose, rounded to a whole folded booklet (a multiple of four). */
export function programmePages(pagesKey: string | undefined): number {
  const n = Number(pagesKey);
  if (!Number.isInteger(n) || n < 4) return 4;
  return Math.min(Math.ceil(n / 4) * 4, 48);
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string; italic?: boolean }
  | { kind: "row"; left: string; right: string }
  | { kind: "item"; text: string };

/** What goes inside, in order. Empty sections are left out. */
export function programmeBlocks(o: PrintInput["options"]): Block[] {
  const b: Block[] = [];
  const service = lines(o.service);
  if (service.length) {
    b.push({ kind: "heading", text: "Order of service" });
    for (const l of service) {
      // "10:00 Arrival of the body" or "10:00 - Arrival": a time on the left when there is one
      const m = l.match(/^(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\s*[-–:]?\s*(.+)$/i);
      b.push(m ? { kind: "row", left: m[1]!.replace(/\s+/g, ""), right: m[2]!.trim() } : { kind: "item", text: l });
    }
  }
  const bio = (o.bio ?? "").trim();
  if (bio) {
    b.push({ kind: "heading", text: "Their life" });
    for (const p of bio.split(/\r?\n\s*\r?\n|\r?\n/).map((s) => s.trim()).filter(Boolean)) b.push({ kind: "para", text: p });
  }
  const [father, mother] = pair(o.parents);
  const family: [string, string[]][] = [
    ["Parents", [father, mother].filter((x): x is string => Boolean(x))],
    ["Spouse", lines(o.spouse)],
    ["Children", lines(o.children)],
    ["Brothers and sisters", lines(o.siblings)],
  ];
  if (family.some(([, v]) => v.length)) {
    b.push({ kind: "heading", text: "Family" });
    for (const [label, names] of family) if (names.length) b.push({ kind: "row", left: label, right: names.join(", ") });
  }
  const hymns = lines(o.hymns);
  if (hymns.length) {
    b.push({ kind: "heading", text: "Hymns" });
    for (const h of hymns) b.push({ kind: "item", text: h });
  }
  const tribute = (o.tribute ?? "").trim();
  if (tribute) {
    b.push({ kind: "heading", text: "Tributes" });
    for (const p of tribute.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) b.push({ kind: "para", text: p, italic: true });
  }
  return b;
}

export function renderProgramme(input: PrintInput, sizeKey: string | undefined): PrintSheet {
  const o = input.options;
  const [W, H] = PAGE_MM[sizeKey ?? "a5"] ?? PAGE_MM.a5!;
  const ink = o.finishKey === "mono" ? INK.mono : INK.colour;
  const k = W / 148; // everything is drawn for A5 and scaled for A4
  const total = programmePages(o.pagesKey);
  const warnings: string[] = [];
  const name = [o.first, o.surname].filter(Boolean).join(" ");
  if (!name) warnings.push("The name is missing.");
  const dates = [o.birth, o.death].filter(Boolean).join(" – ");
  const photo = input.photoHref;
  const margin = 14 * k;
  const inner = W - margin * 2;

  const svgPage = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="${SANS}">` +
    `<rect width="${W}" height="${H}" fill="${ink.paper}"/>` +
    body +
    `</svg>`;
  const text = (x: number, y: number, size: number, body: string, extra = "") =>
    `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size.toFixed(2)}" ${/fill=/.test(extra) ? "" : `fill="${ink.text}" `}${extra}>${esc(body)}</text>`;
  const centre = (y: number, size: number, body: string, extra = "") => text(W / 2, y, size, body, `text-anchor="middle" ${extra}`);
  const border = () =>
    `<rect x="${6 * k}" y="${6 * k}" width="${W - 12 * k}" height="${H - 12 * k}" fill="none" stroke="${ink.gold}" stroke-width="${0.6 * k}"/>` +
    `<rect x="${8 * k}" y="${8 * k}" width="${W - 16 * k}" height="${H - 16 * k}" fill="none" stroke="${ink.gold}" stroke-width="${0.25 * k}"/>`;
  const folio = (n: number) => centre(H - 9 * k, 2.6 * k, String(n), `fill="${ink.sub}"`);

  // ---- page 1: the cover ----
  const cover: string[] = [border()];
  cover.push(centre(24 * k, 3.6 * k, "CELEBRATING THE LIFE OF", `letter-spacing="${0.8 * k}" fill="${ink.gold}"`));
  const ph = { x: W / 2 - 38 * k, y: 31 * k, w: 76 * k, h: 92 * k };
  if (photo) {
    cover.push(
      `<clipPath id="pc"><rect x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" rx="${3 * k}"/></clipPath>` +
        `<image href="${esc(photo)}" xlink:href="${esc(photo)}" x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"${o.finishKey === "mono" ? ' filter="url(#bw)"' : ""}/>` +
        (o.finishKey === "mono" ? `<filter id="bw"><feColorMatrix type="saturate" values="0"/></filter>` : ""),
    );
  } else {
    warnings.push("No photo yet. Most families put one on the cover.");
    cover.push(`<rect x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" rx="${3 * k}" fill="${ink.band}" stroke="${ink.gold}" stroke-width="${0.3 * k}"/>`);
    cover.push(centre(ph.y + ph.h / 2, 3.2 * k, "Their photo", `fill="${ink.sub}"`));
  }
  cover.push(`<rect x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" rx="${3 * k}" fill="none" stroke="${ink.gold}" stroke-width="${0.8 * k}"/>`);
  const nameLines = name.length > 22 ? wrapText(name, 22).slice(0, 2) : [name || "Name missing"];
  const ns = Math.min(...nameLines.map((l) => fitSize(l, inner, 10 * k)));
  let y = 136 * k;
  for (const l of nameLines) {
    cover.push(centre(y, ns, l, `font-family="${SERIF}" font-weight="700" fill="${ink.accent}"`));
    y += ns * 1.15;
  }
  if (dates) cover.push(centre(y + 2 * k, fitSize(dates, inner, 4.6 * k), dates, `fill="${ink.sub}"`));
  y += 10 * k;
  const verse = (o.epitaph ?? "").trim();
  if (verse) {
    for (const l of wrapText(`“${verse}”`, 46).slice(0, 3)) {
      cover.push(centre(y, 3.3 * k, l, `font-family="${SERIF}" font-style="italic" fill="${ink.sub}"`));
      y += 4.6 * k;
    }
  }
  const serviceLine = [o.serviceWhen, o.venue].map((s) => s?.trim()).filter(Boolean) as string[];
  if (serviceLine.length) {
    const top = Math.max(H - 30 * k, y + 8 * k);
    if (top + serviceLine.length * 5 * k > H - 12 * k) warnings.push("The cover is full: shorten the verse or the venue.");
    cover.push(`<rect x="${margin}" y="${top - 6 * k}" width="${inner}" height="${serviceLine.length * 5 * k + 7 * k}" fill="${ink.band}"/>`);
    serviceLine.forEach((s, i) => cover.push(centre(top + i * 5 * k, fitSize(s, inner - 6 * k, 3.4 * k), s, i === 0 ? `font-weight="600"` : `fill="${ink.sub}"`)));
  }

  // ---- inside pages: the blocks flow from page to page ----
  const insidePages = Math.max(total - 2, 0);
  const pagesInside: string[][] = Array.from({ length: insidePages }, () => []);
  const bodySize = 3.3 * k;
  const lh = bodySize * 1.45;
  const charsPerLine = Math.floor(inner / (bodySize * 0.5));
  const top = 20 * k;
  const bottom = H - 16 * k;
  let p = 0;
  let cy = top;
  let overflow = false;
  const room = (h: number) => {
    if (cy + h <= bottom) return true;
    p += 1;
    cy = top;
    return p < insidePages;
  };
  for (const blk of programmeBlocks(o)) {
    if (p >= insidePages) {
      overflow = true;
      break;
    }
    const out = () => pagesInside[p]!;
    if (blk.kind === "heading") {
      // a heading never sits alone at the foot of a page
      if (!room(9 * k + lh * 2)) { overflow = true; break; }
      if (cy > top) cy += 4 * k;
      out().push(text(margin, cy + 4.6 * k, 4.6 * k, blk.text, `font-family="${SERIF}" font-weight="700" fill="${ink.accent}"`));
      out().push(`<rect x="${margin}" y="${cy + 6.4 * k}" width="${18 * k}" height="${0.6 * k}" fill="${ink.gold}"/>`);
      cy += 11 * k;
    } else if (blk.kind === "row") {
      const leftW = Math.min(30 * k, inner * 0.3);
      const rl = wrapText(blk.right, Math.floor((inner - leftW) / (bodySize * 0.5)));
      if (!room(rl.length * lh + 1.5 * k)) { overflow = true; break; }
      out().push(text(margin, cy + bodySize, bodySize, blk.left, `font-weight="600" fill="${ink.accent}"`));
      rl.forEach((l, i) => out().push(text(margin + leftW, cy + bodySize + i * lh, bodySize, l)));
      cy += rl.length * lh + 1.5 * k;
    } else {
      const wrapped = wrapText(blk.kind === "item" ? `•  ${blk.text}` : blk.text, charsPerLine);
      const extra = blk.kind === "para" && blk.italic ? `font-style="italic" font-family="${SERIF}"` : "";
      for (const l of wrapped) {
        if (!room(lh)) { overflow = true; break; }
        out().push(text(margin, cy + bodySize, bodySize, l, extra));
        cy += lh;
      }
      if (overflow) break;
      cy += blk.kind === "para" ? 2.2 * k : 0.6 * k;
    }
  }
  if (overflow) warnings.push(`It does not fit in ${total} pages. Choose more pages, or shorten the life story or the tributes.`);
  else {
    const used = pagesInside.filter((pg) => pg.length).length;
    const enough = Math.max(4, Math.ceil((used + 2) / 4) * 4);
    if (enough < total) warnings.push(`It fits in fewer pages: ${enough} pages would do.`);
  }
  if (insidePages > 0 && pagesInside[0]!.length === 0) {
    warnings.push("The inside is empty. Add the order of service or their life story.");
  }

  // ---- the back page ----
  const back: string[] = [border()];
  back.push(centre(26 * k, 3.4 * k, "SCAN TO SEE THEIR MEMORIAL PAGE", `letter-spacing="${0.5 * k}" fill="${ink.gold}"`));
  back.push(centre(31.5 * k, 3.0 * k, "Share a memory, see photos and the service details", `fill="${ink.sub}"`));
  const qs = 46 * k;
  back.push(`<rect x="${W / 2 - qs / 2 - 3 * k}" y="${37 * k}" width="${qs + 6 * k}" height="${qs + 6 * k}" rx="${2 * k}" fill="#fff" stroke="${ink.gold}" stroke-width="${0.3 * k}"/>`);
  back.push(qrPath(input.qrUrl, W / 2 - qs / 2, 40 * k, qs, "#111"));
  let by = 37 * k + qs + 16 * k;
  const contacts = lines(o.contacts);
  if (contacts.length) {
    back.push(centre(by, 3.8 * k, "Contributions and enquiries", `font-weight="700" fill="${ink.accent}"`));
    by += 6 * k;
    for (const c of contacts.slice(0, 8)) {
      back.push(centre(by, fitSize(c, inner, 3.2 * k), c));
      by += 4.8 * k;
    }
    by += 4 * k;
  }
  const thanks = (o.thanks ?? "").trim();
  if (thanks) {
    back.push(centre(by, 3.8 * k, "Thank you", `font-weight="700" fill="${ink.accent}"`));
    by += 6 * k;
    const tl = wrapText(thanks, Math.floor(inner / (3.1 * k * 0.5)));
    const fits = Math.max(0, Math.floor((H - 34 * k - by) / (4.4 * k)));
    if (tl.length > fits) warnings.push("The thank-you note is too long for the back page; it is shortened.");
    for (const l of tl.slice(0, fits)) {
      back.push(centre(by, 3.1 * k, l, `font-style="italic" font-family="${SERIF}" fill="${ink.sub}"`));
      by += 4.4 * k;
    }
  }
  back.push(compass(W / 2, H - 25 * k, 5 * k, ink.gold));
  back.push(centre(H - 14 * k, 3.6 * k, PRINT_BRAND.name, `font-family="${SERIF}"`));

  const pages = [svgPage(cover.join(""))];
  pagesInside.forEach((body, i) => pages.push(svgPage(body.join("") + folio(i + 2))));
  if (total > 1) pages.push(svgPage(back.join("")));

  // The preview: the pages two to a row, as the booklet reads.
  const gap = 6 * k;
  const cols = 2;
  const rows = Math.ceil(pages.length / cols);
  const SW = cols * W + (cols - 1) * gap;
  const SH = rows * H + (rows - 1) * gap;
  const tiles = pages
    .map((pg, i) => {
      const x = (i % cols) * (W + gap);
      const yy = Math.floor(i / cols) * (H + gap);
      const body = pg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      return `<g transform="translate(${x} ${yy})"><svg x="0" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="hidden">${body}</svg><rect width="${W}" height="${H}" fill="none" stroke="#d6d0c6" stroke-width="0.4"/></g>`;
    })
    .join("");
  // ids inside the tiles (the photo clip) must stay unique: only the cover has one
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SW}mm" height="${SH}mm" viewBox="0 0 ${SW} ${SH}" font-family="${SANS}">` +
    tiles +
    `</svg>`;
  return { svg, widthMm: SW, heightMm: SH, warnings, skin: "paper", pages, pageMm: [W, H] };
}
