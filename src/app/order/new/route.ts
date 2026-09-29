import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { randomToken } from "@/lib/slug";
import { publicOrigin } from "@/lib/origin";

/** Start a guest draft for a product. The token in the URL is the capability. */
export async function GET(req: Request) {
  const origin = await publicOrigin();
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
