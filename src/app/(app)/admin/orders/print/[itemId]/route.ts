import { NextResponse } from "next/server";
import sharp from "sharp";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { renderPrintSheet } from "@/lib/print-sheet";
import type { DraftOptions } from "@/lib/orders";

/**
 * Print sheet for one order item, for the supplier. Admin only.
 *   ?format=svg (default, vector, real millimetres) | png (default 2400px wide)
 * Any layout warnings come back in the X-Print-Warnings header.
 */
export async function GET(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const me = await getSessionUser();
  if (!me?.isPlatformAdmin) return new NextResponse("Not found", { status: 404 });

  const { itemId } = await params;
  const item = await db.orderItem.findUnique({
    where: { id: itemId },
    include: { product: true, qrCode: true },
  });
  if (!item?.qrCode) return new NextResponse("Not found", { status: 404 });
  if (!item.approvedAt) return new NextResponse("The customer has not approved this layout yet", { status: 409 });

  // Print what was frozen at approval, never the live family record.
  const options = (item.layoutSnapshot ?? item.options ?? {}) as DraftOptions;
  const sheet = await renderPrintSheet(
    {
      options,
      productName: item.product.name,
      qrUrl: `${await publicOrigin()}/q/${item.qrCode.code}`,
      pathway: item.product.pathway,
    },
    options.sizeKey,
  );

  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (sheet.warnings.length) headers["X-Print-Warnings"] = encodeURIComponent(sheet.warnings.join(" | "));

  const format = new URL(req.url).searchParams.get("format");
  if (format === "png") {
    const png = await sharp(Buffer.from(sheet.svg)).resize({ width: 2400 }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new NextResponse(sheet.svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
