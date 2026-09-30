import { NextResponse } from "next/server";
import sharp from "sharp";

import { getSessionUser } from "@/lib/rbac";
import { renderItemSheet } from "@/lib/print-order";

/**
 * Print sheet for one order item, for the supplier. Admin only.
 *   ?format=svg (default, vector, real millimetres) | png (default 2400px wide)
 * Any layout warnings come back in the X-Print-Warnings header.
 */
export async function GET(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const me = await getSessionUser();
  if (!me?.isPlatformAdmin) return new NextResponse("Not found", { status: 404 });

  const { itemId } = await params;
  const r = await renderItemSheet(itemId);
  if (!r) return new NextResponse("Not ready: the customer has not approved this layout yet", { status: 409 });

  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (r.sheet.warnings.length) headers["X-Print-Warnings"] = encodeURIComponent(r.sheet.warnings.join(" | "));

  if (new URL(req.url).searchParams.get("format") === "png") {
    const png = await sharp(Buffer.from(r.sheet.svg)).resize({ width: 2400 }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new NextResponse(r.sheet.svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
