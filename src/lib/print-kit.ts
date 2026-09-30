import QRCode from "qrcode";

import type { Layout, Pathway } from "@/lib/layouts";
import type { DraftOptions } from "@/lib/order-shared";

/** Printed brand, in one place until the Family Compass / MyRoots decision is made. */
export const PRINT_BRAND = { name: "Family Compass", tagline: "Our Family. Our Heritage." };

/** Physical sizes in mm, keyed by the size options seeded on products. */
export const SIZES_MM: Record<string, [number, number]> = {
  standard: [200, 300],
  square: [400, 400],
  wall: [600, 400],
  a2: [420, 594],
  a1: [594, 841],
  a3: [297, 420],
  /** a prayer card: front and back side by side, A6 each */
  pack50: [210, 148],
  pack100: [210, 148],
  pack200: [210, 148],
  /** a T-shirt print area */
  tee_s: [300, 400],
  tee_m: [300, 400],
  tee_l: [300, 400],
  tee_xl: [300, 400],
  tee_xxl: [300, 400],
  banner: [2000, 1000],
};

export type Skin = "slate" | "wood" | "paper";

export const SKINS: Record<
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

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? (w[w.length - 1]?.[0] ?? "") : "")).toUpperCase();
};

/** The QR as vector squares, so it prints sharp at any size. */
export function qrPath(text: string, x: number, y: number, size: number, ink: string): string {
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

/** A compass rose, drawn from paths (no fonts, no images). */
export function compass(cx: number, cy: number, r: number, color: string): string {
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


export type PrintInput = {
  options: DraftOptions;
  productName: string;
  qrUrl: string;
  /** "REMEMBERED" marks the focus person with a dagger; "LIVING" does not. */
  pathway: Pathway;
  /** what the piece looks like; defaults to the family tree */
  layout?: Layout;
};

export type PrintSheet = { svg: string; widthMm: number; heightMm: number; warnings: string[]; skin: Skin };

/** Break text into lines of at most `max` characters, at word boundaries. */
export function wrapText(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + w).length > max) {
      out.push(line);
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) out.push(line);
  return out;
}

/** The font size at which `text` fits `width`, never above `max`. */
export const fitSize = (text: string, width: number, max: number) => Math.min(max, width / Math.max(text.length * 0.56, 1));
