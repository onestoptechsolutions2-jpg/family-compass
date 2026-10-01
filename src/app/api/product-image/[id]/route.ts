import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

/** A product photo an admin uploaded. Public, because the shop is; the id never changes its picture. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.productImage.findUnique({
    where: { id },
    select: { bytes: true, thumb: true, mimeType: true, product: { select: { active: true } } },
  });
  // a photo of a product that is not on sale is for admins only
  if (!row || (!row.product.active && !(await getSessionUser())?.isPlatformAdmin)) return new NextResponse("Not found", { status: 404 });
  const small = new URL(req.url).searchParams.get("size") === "thumb";
  return new NextResponse(new Uint8Array(small ? row.thumb : row.bytes), {
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": row.product.active ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
