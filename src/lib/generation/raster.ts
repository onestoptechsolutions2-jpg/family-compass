import { Resvg } from "@resvg/resvg-js";

/** Rasterise an SVG string to a PNG buffer at a target pixel width. */
export function svgToPng(svg: string, targetWidth = 2000): Buffer {
  const r = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "width", value: Math.max(600, Math.min(6000, targetWidth)) },
    font: { loadSystemFonts: true },
  });
  return Buffer.from(r.render().asPng());
}
