import { PDFDocument, StandardFonts, rgb, degrees, type PDFPage, type PDFFont } from "pdf-lib";

import type { ExportData } from "@/lib/export/load";
import { gedcomDate } from "@/lib/export/gedcom";

const A4 = { w: 595.28, h: 841.89 };

function stampPreview(page: PDFPage, font: PDFFont) {
  const { width, height } = page.getSize();
  page.drawText("PREVIEW", {
    x: width / 2 - 170,
    y: height / 2,
    size: 90,
    font,
    color: rgb(0.6, 0.6, 0.65),
    opacity: 0.18,
    rotate: degrees(30),
  });
}

/** Wrap `text` to `maxWidth` at `size` and return the lines. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A single chart image on one landscape page. */
export async function chartPdf(
  png: Buffer,
  opts: { watermark?: boolean; title?: string } = {},
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const img = await doc.embedPng(png);
  const page = doc.addPage([A4.h, A4.w]); // landscape
  const margin = 28;
  const availW = A4.h - margin * 2;
  const availH = A4.w - margin * 2 - (opts.title ? 24 : 0);
  const scale = Math.min(availW / img.width, availH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  if (opts.title) {
    page.drawText(opts.title, { x: margin, y: A4.w - margin - 14, size: 14, font, color: rgb(0.12, 0.14, 0.2) });
  }
  page.drawImage(img, {
    x: (A4.h - w) / 2,
    y: (A4.w - h) / 2 - (opts.title ? 10 : 0),
    width: w,
    height: h,
  });
  if (opts.watermark) stampPreview(page, font);
  return Buffer.from(await doc.save());
}

/** Multi-page narrative family book. */
export async function familyBookPdf(
  data: ExportData,
  opts: { watermark?: boolean; maxPeople?: number } = {},
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);

  const nameOf = new Map<string, string>();
  for (const p of data.people) {
    const n = p.names.find((x) => x.preferred) ?? p.names[0];
    nameOf.set(
      p.id,
      [n?.first, n?.surnamePrefix, n?.surname].filter(Boolean).join(" ").trim() || "Unknown",
    );
  }
  const eventById = new Map(data.events.map((e) => [e.id, e]));
  const placeById = new Map(data.places.map((p) => [p.id, p.title]));

  const childFamOf = new Map<string, string>();
  const famChildren = new Map<string, string[]>();
  const famPartners = new Map<string, [string | null, string | null]>();
  for (const f of data.families) {
    famPartners.set(f.id, [f.partner1Id, f.partner2Id]);
    famChildren.set(f.id, f.childRefs.map((c) => c.personId));
    for (const c of f.childRefs) childFamOf.set(c.personId, f.id);
  }
  const spouseFamsOf = new Map<string, string[]>();
  for (const f of data.families)
    for (const pid of [f.partner1Id, f.partner2Id]) {
      if (!pid) continue;
      const l = spouseFamsOf.get(pid) ?? [];
      l.push(f.id);
      spouseFamsOf.set(pid, l);
    }

  const margin = 54;
  const contentW = A4.w - margin * 2;
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margin;

  const ensure = (need: number) => {
    if (y - need < margin) {
      if (opts.watermark) stampPreview(page, bold);
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - margin;
    }
  };
  const line = (text: string, o: { size?: number; font?: PDFFont; gap?: number; color?: [number, number, number] } = {}) => {
    const size = o.size ?? 10;
    const f = o.font ?? reg;
    for (const l of wrap(text, f, size, contentW)) {
      ensure(size + 4);
      page.drawText(l, { x: margin, y, size, font: f, color: rgb(...(o.color ?? [0.15, 0.16, 0.2])) });
      y -= size + 3;
    }
    y -= o.gap ?? 0;
  };

  // cover
  y = A4.h - 220;
  line(data.tree.name, { size: 28, font: serif, gap: 8 });
  line("A Family Compass book", { size: 12, color: [0.42, 0.45, 0.5], gap: 6 });
  line(
    `${data.people.length} people · ${data.families.length} families · generated ${new Date().toISOString().slice(0, 10)}`,
    { size: 10, color: [0.42, 0.45, 0.5] },
  );
  if (opts.watermark) stampPreview(page, bold);
  page = doc.addPage([A4.w, A4.h]);
  y = A4.h - margin;

  const people = [...data.people].sort((a, b) =>
    (nameOf.get(a.id) ?? "").localeCompare(nameOf.get(b.id) ?? ""),
  );
  const limit = opts.watermark ? Math.min(people.length, opts.maxPeople ?? 6) : people.length;

  for (const p of people.slice(0, limit)) {
    ensure(60);
    y -= 6;
    line(nameOf.get(p.id) ?? "Unknown", { size: 14, font: bold, gap: 2 });

    for (const ref of p.eventRefs) {
      const e = eventById.get(ref.eventId);
      if (!e) continue;
      const d = gedcomDate(e);
      const pl = e.placeId ? placeById.get(e.placeId) : null;
      const bits = [e.type, d, pl].filter(Boolean).join(" · ");
      if (bits) line(bits, { size: 10, color: [0.3, 0.32, 0.38] });
    }
    const fc = childFamOf.get(p.id);
    if (fc) {
      const [a, b] = famPartners.get(fc) ?? [null, null];
      const parents = [a, b].filter(Boolean).map((id) => nameOf.get(id!) ?? "?");
      if (parents.length) line(`Child of ${parents.join(" and ")}`, { size: 10, color: [0.3, 0.32, 0.38] });
    }
    for (const fs of spouseFamsOf.get(p.id) ?? []) {
      const [a, b] = famPartners.get(fs) ?? [null, null];
      const spouse = a === p.id ? b : a;
      const kids = (famChildren.get(fs) ?? []).map((id) => nameOf.get(id) ?? "?");
      if (spouse) line(`Partner: ${nameOf.get(spouse) ?? "?"}`, { size: 10, color: [0.3, 0.32, 0.38] });
      if (kids.length) line(`Children: ${kids.join(", ")}`, { size: 10, color: [0.3, 0.32, 0.38] });
    }
    y -= 8;
  }

  if (opts.watermark) {
    stampPreview(page, bold);
    ensure(40);
    line(
      `Preview shows ${limit} of ${people.length} people. Unlock to download the full book.`,
      { size: 10, font: bold, color: [0.7, 0.2, 0.2] },
    );
  }

  return Buffer.from(await doc.save());
}
