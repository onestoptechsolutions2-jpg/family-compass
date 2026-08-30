import QRCode from "qrcode";

/** Render `text` as a standalone SVG QR code string (server-side, no network). */
export async function qrSvg(text: string, opts: { size?: number; margin?: number } = {}): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 2,
    width: opts.size ?? 240,
    color: { dark: "#1e2330", light: "#ffffff" },
  });
}

/** QR as a data: URI PNG — for places that can't inline SVG (e.g. <img> in PDF). */
export async function qrDataUrl(text: string, size = 512): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: size });
}
