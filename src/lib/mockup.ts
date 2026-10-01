import { SHIRT_COLOURS } from "@/lib/print-kit";

/**
 * A generic picture of a product: the drawn piece set in a simple scene (framed on a wall,
 * a stone or wooden plaque, a paper print, a T-shirt, a banner). Used until a real photo is
 * uploaded, so the shop looks like a shop and never like a spreadsheet.
 */
export type Scene = "framed" | "plaque" | "paper" | "shirt" | "banner";

export function sceneFor(p: { slug: string; layout: string; materialKey?: string }): Scene {
  if (p.layout === "shirt") return "shirt";
  if (p.layout === "banner") return "banner";
  if (p.slug.includes("framed")) return "framed";
  if (p.materialKey === "granite" || p.materialKey === "tile" || p.materialKey === "wood") return "plaque";
  return "paper";
}

export const MOCKUP_W = 1200;
export const MOCKUP_H = 900;

/** Fit the sheet (a full <svg> in millimetres) inside a box, centred, as a nested svg. */
function place(sheetSvg: string, sheetW: number, sheetH: number, box: { x: number; y: number; w: number; h: number }) {
  const k = Math.min(box.w / sheetW, box.h / sheetH);
  const w = sheetW * k;
  const h = sheetH * k;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  const svg = sheetSvg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ` x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"`);
  return { svg, x, y, w, h };
}

const defs = `
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1eadd"/><stop offset="1" stop-color="#e2d8c6"/></linearGradient>
  <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></radialGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="16"/><feComponentTransfer><feFuncA type="linear" slope="0.38"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

const FRAMES: Record<string, { frame: string; edge: string }> = {
  black: { frame: "#1d1d1f", edge: "#3a3a3d" },
  oak: { frame: "#b88a54", edge: "#d3a96f" },
  white: { frame: "#f6f4ef", edge: "#ffffff" },
};

export function mockupSvg(opts: { scene: Scene; sheetSvg: string; sheetW: number; sheetH: number; finishKey?: string }): string {
  const { scene, sheetSvg, sheetW, sheetH } = opts;
  const W = MOCKUP_W;
  const H = MOCKUP_H;
  let body = "";

  if (scene === "framed") {
    const f = FRAMES[opts.finishKey ?? "black"] ?? FRAMES.black!;
    const k = Math.min((H * 0.72) / sheetH, (W * 0.5) / sheetW);
    const mat = 36; // white mount between frame and print
    const pw = sheetW * k;
    const ph = sheetH * k;
    const fw = 26;
    const x0 = (W - pw) / 2 - mat - fw;
    const y0 = (H - ph) / 2 - mat - fw - 10;
    const tw = pw + 2 * (mat + fw);
    const th = ph + 2 * (mat + fw);
    const inner = place(sheetSvg, sheetW, sheetH, { x: x0 + fw + mat, y: y0 + fw + mat, w: pw, h: ph });
    body = `<g filter="url(#shadow)"><rect x="${x0}" y="${y0}" width="${tw}" height="${th}" fill="${f.frame}"/></g>
<rect x="${x0 + 5}" y="${y0 + 5}" width="${tw - 10}" height="${th - 10}" fill="none" stroke="${f.edge}" stroke-width="3"/>
<rect x="${x0 + fw}" y="${y0 + fw}" width="${tw - 2 * fw}" height="${th - 2 * fw}" fill="#fbfaf6"/>
<rect x="${x0 + fw}" y="${y0 + fw}" width="${tw - 2 * fw}" height="${th - 2 * fw}" fill="none" stroke="#00000022" stroke-width="2"/>
${inner.svg}`;
  } else if (scene === "plaque") {
    const k = Math.min((H * 0.74) / sheetH, (W * 0.62) / sheetW);
    const pw = sheetW * k;
    const ph = sheetH * k;
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2 - 8;
    const inner = place(sheetSvg, sheetW, sheetH, { x: x0, y: y0, w: pw, h: ph });
    body = `<g filter="url(#shadow)"><rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="10" fill="#222"/></g>
${inner.svg}
<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="10" fill="none" stroke="#ffffff30" stroke-width="3"/>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="10" fill="url(#gloss)"/>`;
  } else if (scene === "shirt") {
    const c = SHIRT_COLOURS[opts.finishKey ?? "white"] ?? SHIRT_COLOURS.white!;
    const tee = "M330 150 L470 108 Q600 170 730 108 L870 150 L1010 290 L915 380 L850 330 L850 800 Q850 830 820 830 L380 830 Q350 830 350 800 L350 330 L285 380 L190 290 Z";
    const k = Math.min(300 / sheetW, 380 / sheetH);
    const inner = place(sheetSvg, sheetW, sheetH, { x: 600 - (sheetW * k) / 2, y: 250, w: sheetW * k, h: sheetH * k });
    body = `<g filter="url(#shadow)"><path d="${tee}" fill="${c.shirt}"/></g>
<path d="M470 108 Q600 190 730 108" fill="none" stroke="#00000030" stroke-width="10"/>
<path d="${tee}" fill="none" stroke="#00000018" stroke-width="3"/>
${inner.svg}`;
  } else if (scene === "banner") {
    const k = Math.min((W * 0.86) / sheetW, (H * 0.5) / sheetH);
    const pw = sheetW * k;
    const ph = sheetH * k;
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2 - 10;
    const inner = place(sheetSvg, sheetW, sheetH, { x: x0, y: y0, w: pw, h: ph });
    const eyelets = [[x0 + 16, y0 + 16], [x0 + pw - 16, y0 + 16], [x0 + 16, y0 + ph - 16], [x0 + pw - 16, y0 + ph - 16]]
      .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="9" fill="#c9c9c9" stroke="#8a8a8a" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="4" fill="#00000055"/>`)
      .join("");
    body = `<g filter="url(#shadow)"><rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" fill="#fff"/></g>${inner.svg}${eyelets}`;
  } else {
    // paper: a print with a little tape
    const k = Math.min((H * 0.78) / sheetH, (W * 0.58) / sheetW);
    const pw = sheetW * k;
    const ph = sheetH * k;
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2;
    const inner = place(sheetSvg, sheetW, sheetH, { x: x0, y: y0, w: pw, h: ph });
    body = `<g filter="url(#shadow)"><rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" fill="#fff"/></g>${inner.svg}
<rect x="${x0 + pw / 2 - 50}" y="${y0 - 14}" width="100" height="30" fill="#e9dfb8" fill-opacity="0.85" transform="rotate(-2 ${x0 + pw / 2} ${y0})"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="url(#wall)"/>${body}<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}
