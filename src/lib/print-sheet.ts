import QRCode from "qrcode";

import { lines, type DraftOptions } from "@/lib/order-shared";

/** Printed brand, in one place until the Family Compass / MyRoots decision is made. */
export const PRINT_BRAND = { name: "Family Compass", tagline: "Our Family. Our Heritage." };

/** Physical sizes in mm, keyed by the size options seeded on products. */
const SIZES_MM: Record<string, [number, number]> = {
  standard: [200, 300],
  square: [400, 400],
  wall: [600, 400],
  a2: [420, 594],
  a1: [594, 841],
};

export type Skin = "slate" | "wood" | "paper";

const SKINS: Record<
  Skin,
  { bg: string; frame: string; line: string; pillFill: string; pillStroke: string; text: string; sub: string; badge: string; badgeText: string; qrCard: string }
> = {
  slate: { bg: "#1b2333", frame: "#d8cdb6", line: "#cdc2ab", pillFill: "none", pillStroke: "#d8cdb6", text: "#efe6d3", sub: "#bfb49d", badge: "#d8cdb6", badgeText: "#1b2333", qrCard: "#efe6d3" },
  wood: { bg: "#c68f5b", frame: "#4a2a14", line: "#4a2a14", pillFill: "#cf9c69", pillStroke: "#4a2a14", text: "#33190a", sub: "#5a3820", badge: "#4a2a14", badgeText: "#f3dfbd", qrCard: "#e9c99a" },
  paper: { bg: "#ffffff", frame: "#111111", line: "#333333", pillFill: "none", pillStroke: "#111111", text: "#111111", sub: "#555555", badge: "#111111", badgeText: "#ffffff", qrCard: "#ffffff" },
};

/** Material chosen in the wizard decides how the sheet is skinned. */
export function skinForMaterial(materialKey: string | undefined): Skin {
  if (materialKey === "wood") return "wood";
  if (materialKey === "tile" || materialKey === "granite") return "slate";
  return "paper";
}

export type PrintInput = {
  options: DraftOptions;
  productName: string;
  qrUrl: string;
  /** "REMEMBERED" marks the focus person with a dagger; "LIVING" does not. */
  pathway: "LIVING" | "REMEMBERED";
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? (w[w.length - 1]?.[0] ?? "") : "")).toUpperCase();
};

/** The QR as vector squares, so it prints sharp at any size. */
function qrPath(text: string, x: number, y: number, size: number, ink: string): string {
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
  return `<path d="${d}" fill="${ink}"/>`;
}

type Node = { name: string; sub?: string; focus?: boolean; dagger?: boolean };
type Placed = Node & { cx: number; cy: number; w: number; h: number };

/** A compass rose, drawn from paths (no fonts, no images). */
function compass(cx: number, cy: number, r: number, color: string): string {
  const pts = (k: number, a: number) => `${cx + Math.sin(a) * r * k},${cy - Math.cos(a) * r * k}`;
  let star = "";
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const t = pts(1, a), l = pts(0.16, a - Math.PI / 4), rr = pts(0.16, a + Math.PI / 4);
    star += `<polygon points="${t} ${rr} ${cx},${cy} ${l}" fill="${color}"/>`;
    const a2 = a + Math.PI / 4;
    star += `<polygon points="${pts(0.55, a2)} ${pts(0.13, a2 + Math.PI / 4)} ${cx},${cy} ${pts(0.13, a2 - Math.PI / 4)}" fill="${color}" opacity="0.6"/>`;
  }
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.92}" fill="none" stroke="${color}" stroke-width="${r * 0.05}"/>` + star
  );
}

/**
 * The family tree as a print sheet, in real millimetres: focus person centre,
 * parents and grandparents above, spouse beside, children below, brand and QR
 * in the foot. Names are never cut off: text wraps to two lines, then shrinks,
 * and anything unreadably small is reported in `warnings`.
 */
export type PrintSheet = { svg: string; widthMm: number; heightMm: number; warnings: string[]; skin: Skin };

export async function renderPrintSheet(
  input: PrintInput,
  sizeKey: string | undefined,
  skinOverride?: Skin,
): Promise<PrintSheet> {
  // Pass 1 finds the smallest font any name needs; pass 2 prints every name at
  // that one size, so the sheet reads as a single consistent piece.
  const first = await renderOnce(input, sizeKey, skinOverride, undefined);
  if (!Number.isFinite(first.minFs)) return first;
  return renderOnce(input, sizeKey, skinOverride, first.minFs);
}

async function renderOnce(
  input: PrintInput,
  sizeKey: string | undefined,
  skinOverride: Skin | undefined,
  forced: number | undefined,
): Promise<PrintSheet & { minFs: number }> {
  const [W, H] = SIZES_MM[sizeKey ?? "standard"] ?? SIZES_MM.standard!;
  const o = input.options;
  const skin = skinOverride ?? skinForMaterial(o.materialKey);
  const K = SKINS[skin];
  const warnings: string[] = [];
  let out: string[] = [];

  const focusName = [o.first, o.surname].filter(Boolean).join(" ");
  if (!focusName) warnings.push("The name is missing.");
  const dates = [o.birth, o.death].filter(Boolean).join(" – ");

  const [father, mother] = lines(o.parents);
  const fatherParents = lines(o.fatherParents);
  const motherParents = lines(o.motherParents);
  const siblings = lines(o.siblings);
  const spouse = lines(o.spouse)[0];
  const children = lines(o.children);
  if ((fatherParents.length && !father) || (motherParents.length && !mother)) {
    warnings.push("Grandparents were given without their child, so they are not shown.");
  }

  const total =
    1 + [father, mother, spouse].filter(Boolean).length + fatherParents.length + motherParents.length + siblings.length + children.length;
  if (total > 24) warnings.push(`${total} people is above the 24 the layout is proven for; check legibility.`);

  // ---- geometry ----------------------------------------------------------
  const S = Math.min(W, H);
  const m = S * 0.045; // frame inset
  const innerL = m * 1.7;
  const innerR = W - m * 1.7;
  const footH = Math.min(H * 0.3, S * 0.32);
  const top = m * 1.7;
  const treeBottom = H - footH - m;
  const rowH = (treeBottom - top) / 4;
  const rowY = [0, 1, 2, 3].map((i) => top + rowH * (i + 0.5));
  const ph = Math.min(rowH * 0.42, S * 0.07); // pill height
  const minFont = W * 0.012;

  const measure = (s: string, fs: number) => s.length * fs * 0.6;
  let minFs = Infinity;

  /** Lay a pill's text: one line, else two lines, shrinking to fit; never cut. */
  const fitText = (n: Node, w: number, h: number) => {
    const badge = h * 0.62;
    const room = w - badge - h * 0.44;
    let fs = n.focus ? Math.min(h * 0.34, (forced ?? Infinity) * 1.25) : (forced ?? h * 0.36);
    const name = (n.dagger ? "† " : "") + n.name;
    const words = name.split(" ");
    const attempt = (size: number): string[] | null => {
      if (measure(name, size) <= room) return [name];
      // best two-line split
      let best: string[] | null = null;
      let bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" ");
        const b = words.slice(i).join(" ");
        const wmax = Math.max(measure(a, size), measure(b, size));
        if (wmax < bestW) { bestW = wmax; best = [a, b]; }
      }
      return best && bestW <= room ? best : null;
    };
    let ls = attempt(fs);
    while (!ls && fs > minFont * 0.6) {
      fs *= 0.92;
      ls = attempt(fs);
    }
    if (!ls) {
      ls = [name];
      fs = Math.max(room / (name.length * 0.6), minFont * 0.6);
    }
    if (!n.focus) minFs = Math.min(minFs, fs);
    if (fs < minFont) warnings.push(`"${n.name}" prints smaller than ${minFont.toFixed(1)} mm; use a larger size or fewer names.`);
    return { ls, fs, badge };
  };

  const pill = (n: Node, cx: number, cy: number, w: number, h: number): Placed => {
    const { ls, fs, badge } = fitText(n, w, h);
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = h / 2 * (n.focus ? 1 : 0.42);
    const sw = S * 0.0032;
    if (n.focus) {
      out.push(`<rect x="${x - sw * 2}" y="${y - sw * 2}" width="${w + sw * 4}" height="${h + sw * 4}" rx="${r + sw * 2}" fill="none" stroke="${K.pillStroke}" stroke-width="${sw}"/>`);
    }
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${K.pillFill}" stroke="${K.pillStroke}" stroke-width="${sw * (n.focus ? 1.4 : 1)}"/>`);
    const bx = x + h * 0.14 + badge / 2;
    out.push(`<circle cx="${bx}" cy="${cy}" r="${badge / 2}" fill="${K.badge}"/>`);
    out.push(`<text x="${bx}" y="${cy + badge * 0.13}" font-size="${badge * 0.36}" font-weight="700" text-anchor="middle" fill="${K.badgeText}">${esc(initials(n.name))}</text>`);
    const tx = x + h * 0.14 + badge + h * 0.16;
    const sub = n.sub ? fs * 0.78 : 0;
    const blockH = ls.length * fs * 1.1 + (n.sub ? sub * 1.2 : 0);
    let ty = cy - blockH / 2 + fs * 0.9;
    for (const l of ls) {
      out.push(`<text x="${tx}" y="${ty}" font-size="${fs}" fill="${K.text}">${esc(l)}</text>`);
      ty += fs * 1.1;
    }
    if (n.sub) out.push(`<text x="${tx}" y="${ty + sub * 0.1}" font-size="${sub}" fill="${K.sub}">${esc(n.sub)}</text>`);
    if (n.focus) {
      out.push(`<text x="${cx}" y="${y - sw * 5}" font-size="${ph * 0.26}" letter-spacing="${ph * 0.03}" text-anchor="middle" fill="${K.sub}">FOCUS</text>`);
    }
    return { ...n, cx, cy, w, h };
  };

  const conn = (a: Placed, b: Placed) => {
    // from the bottom-centre of the upper pill to the top-centre of the lower one
    out.push(
      `<path d="M${a.cx} ${a.cy + a.h / 2} C${a.cx} ${(a.cy + b.cy) / 2} ${b.cx} ${(a.cy + b.cy) / 2} ${b.cx} ${b.cy - b.h / 2}" fill="none" stroke="${K.line}" stroke-width="${S * 0.0035}" stroke-linecap="round" opacity="0.85"/>`,
    );
  };

  /** n pills spread evenly across the tree width. */
  const row = (nodes: Node[], y: number, maxW: number) => {
    const slot = (innerR - innerL) / Math.max(nodes.length, 1);
    const w = Math.min(slot * 0.92, maxW);
    return nodes.map((n, i) => pill(n, innerL + slot * (i + 0.5), y, w, ph));
  };

  // ---- frame (concave-cornered, like the sample) --------------------------
  const c = m * 1.05;
  const frame = (inset: number, sw: number) => {
    const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
    return `<path d="M${x0 + c} ${y0}H${x1 - c}A${c} ${c} 0 0 0 ${x1} ${y0 + c}V${y1 - c}A${c} ${c} 0 0 0 ${x1 - c} ${y1}H${x0 + c}A${c} ${c} 0 0 0 ${x0} ${y1 - c}V${y0 + c}A${c} ${c} 0 0 0 ${x0 + c} ${y0}Z" fill="none" stroke="${K.frame}" stroke-width="${sw}"/>`;
  };
  out.push(frame(m * 0.55, S * 0.004));
  out.push(frame(m * 0.85, S * 0.0018));

  // ---- the tree ------------------------------------------------------------
  const maxPillW = W * 0.34;
  const gp: Placed[] = [];
  const grand: Node[] = [];
  const grandSlots: (string | undefined)[] = [
    father ? fatherParents[0] : undefined,
    father ? fatherParents[1] : undefined,
    mother ? motherParents[0] : undefined,
    mother ? motherParents[1] : undefined,
  ];
  const hasGrand = grandSlots.some(Boolean);
  const slotW = (innerR - innerL) / 4;
  const gw = Math.min(slotW * 0.92, maxPillW);
  grandSlots.forEach((g, i) => {
    if (g) gp[i] = pill({ name: g }, innerL + slotW * (i + 0.5), rowY[0]!, gw, ph);
  });
  void grand;

  const half = (innerR - innerL) / 2;
  const pw = Math.min(half * 0.6, maxPillW);
  const fp = father ? pill({ name: father }, innerL + half * 0.5, rowY[1]!, pw, ph) : undefined;
  const mp = mother ? pill({ name: mother }, innerL + half * 1.5, rowY[1]!, pw, ph) : undefined;
  if (hasGrand) {
    if (fp) for (const g of [gp[0], gp[1]]) if (g) conn(g, fp);
    if (mp) for (const g of [gp[2], gp[3]]) if (g) conn(g, mp);
  }

  // focus row: siblings, focus, spouse
  const midRow: Node[] = [
    ...siblings.map((s) => ({ name: s })),
    { name: focusName || "Name missing", sub: dates || undefined, focus: true, dagger: input.pathway === "REMEMBERED" },
    ...(spouse ? [{ name: spouse }] : []),
  ];
  const focusIdx = siblings.length;
  const slot = (innerR - innerL) / midRow.length;
  const focusW = Math.min(Math.max(slot * 0.92, W * 0.24), maxPillW * 1.2);
  const midPlaced = midRow.map((n, i) =>
    pill(n, innerL + slot * (i + 0.5), rowY[2]!, n.focus ? focusW : Math.min(slot * 0.92, maxPillW), ph * (n.focus ? 1.45 : 1)),
  );
  const focusP = midPlaced[focusIdx]!;
  for (let i = 0; i <= focusIdx; i++) {
    const p = midPlaced[i]!;
    if (fp) conn(fp, p);
    if (mp) conn(mp, p);
  }
  const spouseP = spouse ? midPlaced[focusIdx + 1] : undefined;
  if (spouseP) {
    out.push(`<line x1="${focusP.cx + focusP.w / 2}" y1="${focusP.cy}" x2="${spouseP.cx - spouseP.w / 2}" y2="${spouseP.cy}" stroke="${K.line}" stroke-width="${S * 0.0035}" opacity="0.85"/>`);
  }

  // children
  const kids = row(children.map((k) => ({ name: k })), rowY[3]!, maxPillW);
  for (const k of kids) conn(focusP, k);

  // ---- foot: brand left, QR right --------------------------------------------
  const fy = H - footH;
  const card = S * 0.012;
  const cap = Math.min(footH * 0.07, W * 0.018);
  const qrSize = Math.min(footH * 0.5, W * 0.2);
  const blockH = qrSize + card * 2 + cap * 3.4;
  const qy = fy + Math.max((footH - m * 1.2 - blockH) / 2, 0) + card;
  const qx = innerR - qrSize - card;
  out.push(`<rect x="${qx - card}" y="${qy - card}" width="${qrSize + card * 2}" height="${qrSize + card * 2}" rx="${card * 1.4}" fill="${K.qrCard}" stroke="${K.frame}" stroke-width="${S * 0.0025}"/>`);
  out.push(qrPath(input.qrUrl, qx, qy, qrSize, "#111"));
  out.push(`<text x="${qx + qrSize / 2}" y="${qy + qrSize + card + cap * 1.4}" font-size="${cap}" font-weight="700" letter-spacing="${cap * 0.06}" text-anchor="middle" fill="${K.text}">SCAN TO VIEW THE</text>`);
  out.push(`<text x="${qx + qrSize / 2}" y="${qy + qrSize + card + cap * 2.6}" font-size="${cap}" font-weight="700" letter-spacing="${cap * 0.06}" text-anchor="middle" fill="${K.text}">FULL FAMILY TREE</text>`);

  const bx = innerL + (qx - card * 2 - innerL) / 2;
  const avail = footH - m * 1.2;
  const cr = Math.min(avail * 0.24, W * 0.06);
  const bs = Math.min(avail * 0.17, (qx - card * 2 - innerL) / (PRINT_BRAND.name.length * 0.6));
  const top0 = fy + Math.max((avail - (cr * 2 + bs * 2.6 + bs * 0.9)) / 2, 0);
  out.push(compass(bx, top0 + cr, cr, K.frame));
  out.push(`<text x="${bx}" y="${top0 + cr * 2 + bs * 1.0}" font-size="${bs}" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle" fill="${K.text}">${esc(PRINT_BRAND.name)}</text>`);
  out.push(`<text x="${bx}" y="${top0 + cr * 2 + bs * 1.9}" font-size="${bs * 0.42}" font-style="italic" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle" fill="${K.sub}">${esc(PRINT_BRAND.tagline)}</text>`);
  out.push(`<text x="${bx}" y="${top0 + cr * 2 + bs * 2.6}" font-size="${bs * 0.26}" text-anchor="middle" fill="${K.sub}">${esc(input.qrUrl.replace(/^https?:\/\//, ""))}</text>`);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" ` +
    `font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif">` +
    `<rect width="${W}" height="${H}" fill="${K.bg}"/>` +
    out.join("") +
    `</svg>`;
  return { svg, widthMm: W, heightMm: H, warnings, skin, minFs };
}
