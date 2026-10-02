import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { randomToken } from "@/lib/slug";
import { publicOrigin } from "@/lib/origin";
import { hitLimit } from "@/lib/api/rate-limit";
import { clientIpFromHeaders } from "@/lib/user-agent";

/** Start a guest draft for a product. The token in the URL is the capability. */
export async function GET(req: Request) {
  const origin = await publicOrigin();
  // Each visit makes a draft row; blunt bots and refresh loops (10 per IP per hour).
  const ip = clientIpFromHeaders(req.headers) ?? "unknown";
  if (!hitLimit(`order-new:${ip}`, 10, 3600)) {
    return new NextResponse("Too many drafts started. Please try again later.", { status: 429 });
  }
  const slug = new URL(req.url).searchParams.get("product") ?? "";
  const product = await db.product.findUnique({ where: { slug } });
  if (!product || !product.active) return NextResponse.redirect(`${origin}/remembered`);

  const token = randomToken(24);
  await db.order.create({
    data: {
      guestToken: token,
      items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: {} } },
    },
  });
  return NextResponse.redirect(`${origin}/order/${token}?step=1`);
}
