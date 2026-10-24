import "server-only";
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import type { PrintSheet } from "@/lib/print-sheet";

const PT_PER_MM = 72 / 25.4;

/**
 * The print file as a PDF, one page per page of the piece (a programme's pages in reading
 * order; anything else on a single page), each at 300 dpi and its real size.
 */
export async function sheetPdf(sheet: PrintSheet): Promise<Uint8Array> {
  const pages = sheet.pages?.length ? sheet.pages : [sheet.svg];
  const [wMm, hMm] = sheet.pages?.length && sheet.pageMm ? sheet.pageMm : [sheet.widthMm, sheet.heightMm];
  const px = Math.round((wMm / 25.4) * 300);
  const pdf = await PDFDocument.create();
  for (const svg of pages) {
    const jpg = await sharp(Buffer.from(svg), { density: 300, limitInputPixels: 400_000_000 }).resize({ width: px }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
    const img = await pdf.embedJpg(jpg);
    const page = pdf.addPage([wMm * PT_PER_MM, hMm * PT_PER_MM]);
    page.drawImage(img, { x: 0, y: 0, width: wMm * PT_PER_MM, height: hMm * PT_PER_MM });
  }
  return pdf.save();
}

/** Answer a print-file request: ?format=svg (default) | png | pdf. */
export async function sheetResponse(sheet: PrintSheet, format: string | null, headers: Record<string, string>, name = "print"): Promise<NextResponse> {
  if (format === "pdf") {
    return new NextResponse(new Uint8Array(await sheetPdf(sheet)), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"` },
    });
  }
  if (format === "png") {
    const png = await sharp(Buffer.from(sheet.svg)).resize({ width: 2400 }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new NextResponse(sheet.svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
