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

export type MemorialBookData = {
  name: string;
  headline: string | null;
  born: string;
  died: string;
  bornPlace?: string | null;
  diedPlace?: string | null;
  restingPlace: string | null;
  eulogy: string | null;
  serviceText: string | null;
  clan?: string | null;
  subClan?: string | null;
  community?: string | null;
  clanOrigin?: string | null;
  parents?: string[];
  spouses?: string[];
  children?: string[];
  survivors: string[];
  preceded: string[];
  timeline?: { type: string; date: string; place: string | null; note: string | null }[];
  program: { venue: string | null; serviceDate: Date | null; committee: string | null; order: { title: string; detail?: string }[] } | null;
  guestbook?: { name: string; relation: string | null; message: string; date: string }[];
  cover: { bytes: Buffer; mime: string } | null;
  photos?: { bytes: Buffer; mime: string; caption?: string | null }[];
};

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function bookTheme(template?: string) {
  const t = template ?? "classic";
  const accent =
    t === "linkedin" ? "#0a66c2" : t === "stripe" ? "#635bff" : t === "x" ? "#1d9bf0" : "#a9773f";
  return {
    accent: hex(accent),
    ink: hex("#1e2330") as Rgb,
    muted: hex("#5b6472") as Rgb,
    coverTint: t === "classic" ? hex("#f6ece0") : hex("#f4f6fb"),
    useSerif: t === "classic",
  };
}

/**
 * A full page-by-page keepsake book about a deceased person — biography,
 * family, milestones, roots, photographs, the order of service and the
 * guestbook tributes — rendered in the memorial's chosen style.
 */
export async function memorialBookPdf(
  d: MemorialBookData,
  opts: { watermark?: boolean; template?: string } = {},
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const th = bookTheme(opts.template);
  const headFont = th.useSerif ? timesBold : bold;
  const bodyFont = th.useSerif ? times : reg;

  const margin = 56;
  const contentW = A4.w - margin * 2;
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margin;

  const stamp = () => opts.watermark && stampPreview(page, bold);
  const newPage = () => {
    stamp();
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - margin;
  };
  const ensure = (need: number) => {
    if (y - need < margin) newPage();
  };
  const text = (
    s: string,
    o: { size?: number; font?: PDFFont; gap?: number; color?: Rgb; x?: number; maxW?: number } = {},
  ) => {
    const size = o.size ?? 10.5;
    const f = o.font ?? bodyFont;
    for (const l of wrap(s, f, size, o.maxW ?? contentW)) {
      ensure(size + 5);
      page.drawText(l, { x: o.x ?? margin, y, size, font: f, color: rgb(...(o.color ?? th.ink)) });
      y -= size + 4.5;
    }
    if (o.gap) y -= o.gap;
  };
  const section = (title: string) => {
    newPage();
    page.drawRectangle({ x: margin, y: y - 2, width: 46, height: 3, color: rgb(...th.accent) });
    y -= 20;
    text(title, { size: 20, font: headFont, gap: 12 });
  };
  const kv = (label: string, value: string) => {
    if (!value) return;
    ensure(16);
    page.drawText(label.toUpperCase(), { x: margin, y, size: 8, font: bold, color: rgb(...th.muted) });
    y -= 12;
    text(value, { gap: 6 });
  };
  const drawImage = async (bytes: Buffer, mime: string, boxW: number, boxH: number, cx: number) => {
    try {
      const img = mime.includes("png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ensure(h + 8);
      page.drawImage(img, { x: cx - w / 2, y: y - h, width: w, height: h });
      y -= h + 10;
      return true;
    } catch {
      return false;
    }
  };

  // ---------- cover ----------
  page.drawRectangle({ x: 0, y: A4.h - 210, width: A4.w, height: 210, color: rgb(...th.coverTint) });
  y = A4.h - 150;
  if (d.cover) await drawImage(d.cover.bytes, d.cover.mime, 300, 300, A4.w / 2);
  y -= 8;
  text(d.headline ?? `In loving memory of ${d.name}`, { size: 26, font: headFont, gap: 6 });
  text(d.name, { size: 13, color: th.muted, gap: 4 });
  const years = [d.born, d.died].filter(Boolean).join("  —  ");
  if (years) text(years, { size: 11, color: th.muted });
  if (d.restingPlace) text(`Laid to rest at ${d.restingPlace}`, { size: 10, color: th.muted });

  // ---------- life ----------
  if (d.eulogy) {
    section("A life");
    for (const para of d.eulogy.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)) {
      text(para, { size: 11, gap: 9 });
    }
  }

  // ---------- family ----------
  const fam = [
    d.parents?.length ? ["Parents", d.parents.join(", ")] : null,
    d.spouses?.length ? [d.spouses.length > 1 ? "Married to" : "Spouse", d.spouses.join(", ")] : null,
    d.children?.length ? ["Children", d.children.join(", ")] : null,
    d.survivors.length ? ["Survived by", d.survivors.join(", ")] : null,
    d.preceded.length ? ["Preceded in death by", d.preceded.join(", ")] : null,
  ].filter(Boolean) as [string, string][];
  if (fam.length) {
    section("Family");
    for (const [k, v] of fam) kv(k, v);
  }

  // ---------- milestones ----------
  if (d.timeline && d.timeline.length) {
    section("Milestones");
    for (const e of d.timeline) {
      ensure(20);
      page.drawText(e.type, { x: margin, y, size: 10.5, font: bold, color: rgb(...th.ink) });
      if (e.date) page.drawText(e.date, { x: margin + 120, y, size: 10.5, font: bodyFont, color: rgb(...th.muted) });
      y -= 14;
      const detail = [e.place, e.note].filter(Boolean).join(" — ");
      if (detail) text(detail, { size: 10, color: th.muted, gap: 4 });
      else y -= 2;
    }
  }

  // ---------- roots ----------
  if (d.clan || d.community || d.subClan) {
    section("Roots");
    kv("Clan", [d.clan, d.subClan ? `(${d.subClan})` : ""].filter(Boolean).join(" "));
    if (d.community) kv("Community", d.community);
    if (d.clanOrigin) kv("Origin", d.clanOrigin);
    if (d.bornPlace) kv("Born in", d.bornPlace);
  }

  // ---------- photographs ----------
  if (d.photos && d.photos.length) {
    section("Photographs");
    for (const ph of d.photos.slice(0, 12)) {
      const ok = await drawImage(ph.bytes, ph.mime, contentW, 300, A4.w / 2);
      if (ok && ph.caption) text(ph.caption, { size: 9, color: th.muted, gap: 10 });
      else if (ok) y -= 6;
    }
  }

  // ---------- order of service ----------
  if (d.program || d.serviceText) {
    section("Order of service");
    if (d.program?.venue) kv("Venue", d.program.venue);
    if (d.program?.serviceDate) kv("Date", d.program.serviceDate.toISOString().slice(0, 10));
    if (d.program && d.program.order.length) {
      y -= 2;
      d.program.order.forEach((it, i) =>
        text(`${i + 1}.  ${it.title}${it.detail ? `  —  ${it.detail}` : ""}`, { size: 10.5, gap: 3 }),
      );
    }
    if (d.serviceText) {
      y -= 6;
      text(d.serviceText, { size: 10, color: th.muted, gap: 6 });
    }
    if (d.program?.committee) {
      y -= 4;
      kv("Committee", d.program.committee);
    }
  }

  // ---------- tributes ----------
  if (d.guestbook && d.guestbook.length) {
    section("Tributes");
    for (const g of d.guestbook) {
      ensure(30);
      page.drawText(
        `${g.name}${g.relation ? ` · ${g.relation}` : ""}`,
        { x: margin, y, size: 10, font: bold, color: rgb(...th.ink) },
      );
      page.drawText(g.date, { x: A4.w - margin - 60, y, size: 9, font: bodyFont, color: rgb(...th.muted) });
      y -= 13;
      text(g.message, { size: 10, gap: 10 });
    }
  }

  // ---------- colophon ----------
  newPage();
  y = A4.h / 2;
  text("Compiled with Family Compass", { size: 11, font: headFont, gap: 4 });
  text(new Date().toISOString().slice(0, 10), { size: 9, color: th.muted });

  stamp();
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
