import { lines } from "@/lib/order-shared";
import {
  SHIRT_COLOURS,
  PRINT_BRAND, SKINS, SIZES_MM, compass, esc, fitSize, qrPath, wrapText,
  type PrintInput, type PrintSheet, type Skin,
} from "@/lib/print-kit";

const svgOf = (W: number, H: number, body: string, bg: string | null, font = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="${font}">` +
  (bg ? `<rect width="${W}" height="${H}" fill="${bg}"/>` : "") +
  body +
  `</svg>`;

/** A text element with a default colour, unless the caller sets its own. */
const textEl = (x: number, y: number, size: number, body: string, defaultFill: string, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${size}" ${/fill=/.test(extra) ? "" : `fill="${defaultFill}" `}${extra}>${esc(body)}</text>`;

const SERIF = "Georgia, 'Times New Roman', serif";
const shortUrl = (u: string) => u.replace(/^https?:\/\//, "");

/* ------------------------------------------------------------------------------------------
 * Memorial prayer card: front and back side by side, A6 each, for the whole pack.
 * ------------------------------------------------------------------------------------------ */
export function renderCard(input: PrintInput, sizeKey: string | undefined, skinOverride?: Skin): PrintSheet {
  const o = input.options;
  const skin = skinOverride ?? "paper";
  const K = SKINS[skin];
  const warnings: string[] = [];
  const [W, H] = SIZES_MM[sizeKey ?? "pack50"] ?? [210, 148];
  const pw = W / 2;
  const out: string[] = [];
  const t = (x: number, y: number, size: number, body: string, extra = "") =>
    out.push(textEl(x, y, size, body, K.text, `text-anchor="middle" ${extra}`));

  const name = [o.first, o.surname].filter(Boolean).join(" ");
  if (!name) warnings.push("The name is missing.");
  const dates = [o.birth, o.death].filter(Boolean).join(" – ");
  const verse = (o.epitaph ?? "").trim();
  if (verse.length > 160) warnings.push("The verse is long; it will print small. Shorter reads better on a card.");

  for (const x0 of [0, pw]) {
    out.push(`<rect x="${x0 + 5}" y="5" width="${pw - 10}" height="${H - 10}" rx="3" fill="none" stroke="${K.frame}" stroke-width="0.5"/>`);
    out.push(`<rect x="${x0 + 7}" y="7" width="${pw - 14}" height="${H - 14}" rx="2" fill="none" stroke="${K.frame}" stroke-width="0.25"/>`);
  }

  // ---- front ----
  const cx = pw / 2;
  out.push(`<rect x="${cx - 0.9}" y="16" width="1.8" height="14" fill="${K.text}"/><rect x="${cx - 4.5}" y="20" width="9" height="1.8" fill="${K.text}"/>`);
  t(cx, 40, 3.4, "IN LOVING MEMORY", `letter-spacing="0.5" fill="${K.sub}"`);
  const nameLines = name.length > 18 ? wrapText(name, 18) : [name || "Name missing"];
  const ns = fitSize(nameLines.reduce((a, b) => (a.length >= b.length ? a : b), ""), pw - 22, 9.5);
  let y = 54;
  for (const l of nameLines) {
    t(cx, y, ns, l, `font-weight="700" font-family="${SERIF}"`);
    y += ns * 1.15;
  }
  if (dates) {
    t(cx, y + 2, fitSize(dates, pw - 22, 4.6), dates);
    y += 9;
  }
  if (verse) {
    const vlines = wrapText(`“${verse}”`, 26).slice(0, 6);
    const vs = vlines.length > 4 ? 3.0 : 3.6;
    y += 5;
    for (const l of vlines) {
      t(cx, y, vs, l, `font-style="italic" font-family="${SERIF}" fill="${K.sub}"`);
      y += vs * 1.35;
    }
  }

  // ---- back ----
  const bx = pw + pw / 2;
  t(bx, 22, 3.2, "SCAN TO SEE THEIR MEMORIAL", `letter-spacing="0.4" fill="${K.sub}"`);
  t(bx, 27.5, 3.2, "AND SHARE A MEMORY", `letter-spacing="0.4" fill="${K.sub}"`);
  const qs = Math.min(pw * 0.5, 44);
  out.push(`<rect x="${bx - qs / 2 - 3}" y="34" width="${qs + 6}" height="${qs + 6}" rx="2" fill="#fff" stroke="${K.frame}" stroke-width="0.3"/>`);
  out.push(qrPath(input.qrUrl, bx - qs / 2, 37, qs, "#111"));
  const ny = 37 + qs + 14;
  t(bx, ny, fitSize(name || "—", pw - 22, 5.2), name, `font-weight="700" font-family="${SERIF}"`);
  if (dates) t(bx, ny + 6, 3.6, dates, `fill="${K.sub}"`);
  out.push(compass(bx, H - 22, 6, K.frame));
  t(bx, H - 11, 4.2, PRINT_BRAND.name, `font-family="${SERIF}"`);
  t(bx, H - 8.2, 2.1, shortUrl(input.qrUrl), `fill="${K.sub}"`);

  return { svg: svgOf(W, H, out.join(""), K.bg), widthMm: W, heightMm: H, warnings, skin };
}

/* ------------------------------------------------------------------------------------------
 * Family birthday calendar: a year planner with every date on it.
 * ------------------------------------------------------------------------------------------ */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthIndex = (w: string) => {
  const k = w.trim().toLowerCase();
  return MONTHS.findIndex((m) => m.toLowerCase() === k || (k.length >= 3 && m.toLowerCase().startsWith(k.slice(0, 3)) && k.length <= m.length));
};

export type CalendarEntry = { name: string; day: number; month: number; year?: number };

/** "Ann Kamau, 3 March 1985" → an entry; anything unreadable is reported. */
export function parseBirthdays(text: string | undefined): { entries: CalendarEntry[]; bad: string[] } {
  const entries: CalendarEntry[] = [];
  const bad: string[] = [];
  for (const line of lines(text)) {
    const comma = line.lastIndexOf(",");
    const name = comma > 0 ? line.slice(0, comma).trim() : "";
    const date = comma > 0 ? line.slice(comma + 1).trim() : "";
    const m = date.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?$/);
    const mi = m ? monthIndex(m[2]!) : -1;
    const day = m ? Number(m[1]) : 0;
    if (!name || mi < 0 || day < 1 || day > 31) {
      bad.push(line);
      continue;
    }
    entries.push({ name, day, month: mi, year: m?.[3] ? Number(m[3]) : undefined });
  }
  return { entries, bad };
}

export function renderCalendar(input: PrintInput, sizeKey: string | undefined, skinOverride?: Skin): PrintSheet {
  const o = input.options;
  const skin = skinOverride ?? "paper";
  const K = SKINS[skin];
  const warnings: string[] = [];
  const [W, H] = SIZES_MM[sizeKey ?? "a3"] ?? SIZES_MM.a3!;
  const year = Number(o.year) || new Date().getFullYear() + 1;
  const { entries, bad } = parseBirthdays(o.birthdays);
  for (const b of bad) warnings.push(`Could not read the date on “${b}”. Use: Name, 3 March 1985`);
  if (!o.surname) warnings.push("The family name is missing.");

  const out: string[] = [];
  const t = (x: number, y: number, size: number, body: string, extra = "") =>
    out.push(textEl(x, y, size, body, K.text, extra));
  const S = W;
  const m = S * 0.05;
  const title = o.title?.trim() || (o.surname ? `The ${o.surname} Family` : "Family calendar");

  t(W / 2, m + S * 0.045, fitSize(title, W - 2 * m, S * 0.06), title, `text-anchor="middle" font-weight="700" font-family="${SERIF}"`);
  t(W / 2, m + S * 0.045 + S * 0.075, S * 0.055, String(year), `text-anchor="middle" fill="${K.sub}" letter-spacing="${S * 0.006}"`);

  const top = m + S * 0.16;
  const foot = H * 0.085;
  const gridH = H - top - foot - m;
  const cols = 3, rowsN = 4;
  const cw = (W - 2 * m) / cols;
  const ch = gridH / rowsN;
  const minFont = W * 0.0075;
  let minSeen = Infinity;

  for (let mi = 0; mi < 12; mi++) {
    const x = m + (mi % cols) * cw;
    const y = top + Math.floor(mi / cols) * ch;
    const days = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
    const first = (new Date(Date.UTC(year, mi, 1)).getUTCDay() + 6) % 7; // Monday first
    const mine = entries.filter((e) => e.month === mi && e.day <= days).sort((a, b) => a.day - b.day);
    const dayset = new Set(mine.map((e) => e.day));
    const gx = x + cw * 0.05;
    const gw = cw * 0.9;
    const cell = gw / 7;
    const rowsUsed = Math.ceil((first + days) / 7);
    const gridTop = y + ch * 0.13;
    const fs = Math.min(cell * 0.42, ch * 0.05);

    t(x + cw / 2, y + ch * 0.085, Math.min(ch * 0.085, cw * 0.11), MONTHS[mi]!.toUpperCase(), `text-anchor="middle" font-weight="700" letter-spacing="${cw * 0.006}"`);
    "MTWTFSS".split("").forEach((d, i) => t(gx + cell * (i + 0.5), gridTop + fs, fs * 0.8, d, `text-anchor="middle" fill="${K.sub}"`));
    for (let d = 1; d <= days; d++) {
      const idx = first + d - 1;
      const cx = gx + cell * ((idx % 7) + 0.5);
      const cy = gridTop + fs * 2.4 + Math.floor(idx / 7) * fs * 1.75;
      if (dayset.has(d)) {
        out.push(`<circle cx="${cx}" cy="${cy - fs * 0.32}" r="${fs * 0.95}" fill="${K.text}"/>`);
        t(cx, cy, fs, String(d), `text-anchor="middle" font-weight="700" fill="${K.bg}"`);
      } else {
        t(cx, cy, fs, String(d), `text-anchor="middle"`);
      }
    }

    // the names for this month, under its grid
    void rowsUsed;
    const listTop = gridTop + fs * 2.4 + 6 * fs * 1.75 + fs * 0.6; // room for the longest month, so lists line up
    const room = y + ch - listTop - ch * 0.02;
    const perLine = Math.max(mine.length, 1);
    const lh = Math.min(fs * 1.5, room / perLine);
    const lf = lh / 1.35;
    if (mine.length) minSeen = Math.min(minSeen, lf);
    mine.forEach((e, i) => {
      const age = e.year && e.year <= year ? ` (${year - e.year})` : "";
      const txt = `${e.day}  ${e.name}${age}`;
      const size = Math.min(lf, fitSize(txt, gw, lf));
      minSeen = Math.min(minSeen, size);
      t(gx, listTop + lh * (i + 0.8), size, txt);
    });
  }
  if (minSeen < minFont) warnings.push("Some months have so many names that they print very small. Choose the larger size.");

  // foot: brand, QR
  const fy = H - foot - m * 0.4;
  const qs = foot * 0.85;
  out.push(`<rect x="${W - m - qs - 2}" y="${fy - 2}" width="${qs + 4}" height="${qs + 4}" rx="2" fill="#fff" stroke="${K.frame}" stroke-width="0.3"/>`);
  out.push(qrPath(input.qrUrl, W - m - qs, fy, qs, "#111"));
  t(W - m - qs - 5, fy + qs * 0.45, Math.min(foot * 0.16, 4.5), "SCAN TO ADD YOUR BIRTHDAY", `text-anchor="end" font-weight="700" letter-spacing="0.3"`);
  t(W - m - qs - 5, fy + qs * 0.45 + Math.min(foot * 0.2, 5.5), Math.min(foot * 0.13, 3.6), shortUrl(input.qrUrl), `text-anchor="end" fill="${K.sub}"`);
  out.push(compass(m + foot * 0.4, fy + qs / 2, foot * 0.32, K.frame));
  t(m + foot * 0.85, fy + qs * 0.58, foot * 0.3, PRINT_BRAND.name, `font-family="${SERIF}"`);

  return { svg: svgOf(W, H, out.join(""), K.bg), widthMm: W, heightMm: H, warnings, skin };
}

/* ------------------------------------------------------------------------------------------
 * Reunion name badges: every guest, cut-ready, on one sheet.
 * ------------------------------------------------------------------------------------------ */
const BADGE_CAPACITY: Record<string, number> = { badges20: 20, badges50: 50 };

export function renderBadges(input: PrintInput, sizeKey: string | undefined, skinOverride?: Skin): PrintSheet {
  const o = input.options;
  const skin = skinOverride ?? "paper";
  const K = SKINS[skin];
  const warnings: string[] = [];
  const cap = BADGE_CAPACITY[sizeKey ?? "badges20"] ?? 20;
  const guests = lines(o.attendees).map((l) => {
    const i = l.lastIndexOf(",");
    return i > 0 ? { name: l.slice(0, i).trim(), rel: l.slice(i + 1).trim() } : { name: l, rel: "" };
  });
  if (!guests.length) warnings.push("No guests yet. Add one per line: Name, relation.");
  if (guests.length > cap) warnings.push(`${guests.length} guests is more than this pack covers (${cap}). Choose the larger pack.`);
  if (!o.surname && !o.title) warnings.push("The event name is missing.");
  const list = guests.length ? guests : [{ name: "Guest name", rel: "Relation" }];

  const bw = 90, bh = 55, gap = 8, cols = 2;
  const rows = Math.ceil(list.length / cols);
  const W = cols * bw + (cols + 1) * gap;
  const H = rows * bh + (rows + 1) * gap;
  const event = o.title?.trim() || (o.surname ? `${o.surname} Family Reunion` : "Family Reunion");
    const out: string[] = [];

  list.forEach((g, i) => {
    const x = gap + (i % cols) * (bw + gap);
    const y = gap + Math.floor(i / cols) * (bh + gap);
    const cx = x + (bw - 26) / 2;
    out.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="#fff" stroke="${K.frame}" stroke-width="0.35" stroke-dasharray="1.6 1.2"/>`);
    out.push(`<text x="${cx}" y="${y + 9}" font-size="${fitSize(event.toUpperCase(), bw - 30, 3.6)}" text-anchor="middle" fill="${K.sub}" letter-spacing="0.3">${esc(event.toUpperCase())}</text>`);
    out.push(`<line x1="${x + 6}" y1="${y + 12}" x2="${x + bw - 6}" y2="${y + 12}" stroke="${K.frame}" stroke-width="0.3"/>`);
    const nl = g.name.length > 16 ? wrapText(g.name, 16).slice(0, 2) : [g.name];
    const ns = fitSize(nl.reduce((a, b) => (a.length >= b.length ? a : b), ""), bw - 34, nl.length > 1 ? 8 : 10.5);
    let ty = y + 27 - (nl.length - 1) * ns * 0.55;
    for (const l of nl) {
      out.push(`<text x="${cx}" y="${ty}" font-size="${ns}" font-weight="700" text-anchor="middle" fill="#111" font-family="${SERIF}">${esc(l)}</text>`);
      ty += ns * 1.1;
    }
    if (g.rel) {
      const hostFirst = (o.first ?? "").trim().split(/\s+/)[0] ?? "";
      const isHost = /^host(ess)?$/i.test(g.rel);
      const rel = isHost || !hostFirst ? g.rel : `${g.rel} of ${hostFirst}`;
      out.push(`<text x="${cx}" y="${y + bh - 11}" font-size="${fitSize(rel, bw - 36, 4.6)}" text-anchor="middle" fill="${K.sub}">${esc(rel)}</text>`);
    }
    const qs = 17;
    out.push(`<rect x="${x + bw - qs - 5}" y="${y + bh - qs - 5}" width="${qs}" height="${qs}" fill="#fff"/>`);
    out.push(qrPath(input.qrUrl, x + bw - qs - 5, y + bh - qs - 5, qs, "#111"));
    out.push(`<text x="${x + 6}" y="${y + bh - 4}" font-size="2.6" fill="${K.sub}">${esc(PRINT_BRAND.name)}</text>`);
  });
  return { svg: svgOf(W, H, out.join(""), "#ffffff"), widthMm: W, heightMm: H, warnings, skin };
}

/* ------------------------------------------------------------------------------------------
 * Reunion T-shirt: artwork on no background, for a light shirt.
 * ------------------------------------------------------------------------------------------ */
export function renderShirt(input: PrintInput, sizeKey: string | undefined): PrintSheet {
  const o = input.options;
  const shirt = SHIRT_COLOURS[o.finishKey ?? "white"] ?? SHIRT_COLOURS.white!;
  const K = { ...SKINS.paper, text: shirt.ink, sub: shirt.sub, frame: shirt.ink };
  const warnings: string[] = [];
  const [W, H] = SIZES_MM[sizeKey ?? "tee_m"] ?? [300, 400];
  const family = (o.surname ?? "").trim();
  if (!family) warnings.push("The family name is missing.");
  const out: string[] = [];
  const t = (y: number, size: number, body: string, extra = "") =>
    out.push(textEl(W / 2, y, size, body, K.text, `text-anchor="middle" ${extra}`));

  out.push(compass(W / 2, 46, 26, K.frame));
  const name = (family || "FAMILY").toUpperCase();
  const ns = fitSize(name, W - 30, 62);
  t(118 + ns * 0.2, ns, name, `font-weight="800" letter-spacing="${ns * 0.04}" font-family="${SERIF}"`);
  const title = o.title?.trim() || "Family Reunion";
  const ts = fitSize(title.toUpperCase(), W - 40, 20);
  t(150 + ns * 0.2 + ts, ts, title.toUpperCase(), `letter-spacing="${ts * 0.12}"`);
  const when = [o.year, o.place].filter(Boolean).join("  ·  ");
  if (when) t(165 + ns * 0.2 + ts * 2.2, fitSize(when, W - 60, 14), when, `fill="${K.sub}"`);
  out.push(`<line x1="${W * 0.3}" y1="${H - 100}" x2="${W * 0.7}" y2="${H - 100}" stroke="${K.frame}" stroke-width="0.8"/>`);
  const qs = 50;
  out.push(`<rect x="${W / 2 - qs / 2 - 4}" y="${H - 92}" width="${qs + 8}" height="${qs + 8}" rx="3" fill="#fff" stroke="${K.frame}" stroke-width="0.6"/>`);
  out.push(qrPath(input.qrUrl, W / 2 - qs / 2, H - 88, qs, "#111"));
  t(H - 20, 7.5, "SCAN FOR OUR FAMILY", `font-weight="700" letter-spacing="1"`);
  return { svg: svgOf(W, H, out.join(""), null, SERIF), widthMm: W, heightMm: H, warnings, skin: "paper" };
}
