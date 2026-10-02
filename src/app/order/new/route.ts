import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { randomToken } from "@/lib/slug";
import { publicOrigin } from "@/lib/origin";
import { hitLimit } from "@/lib/api/rate-limit";
import { clientIpFromHeaders } from "@/lib/user-agent";
import { VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";
import { getSessionUser } from "@/lib/rbac";
import { savedDraftForPerson } from "@/lib/order-sources";

/** Start a guest draft for a product. The token in the URL is the capability. */
export async function GET(req: Request) {
  const origin = await publicOrigin();
  // Each visit makes a draft row; blunt bots and refresh loops (10 per IP per hour).
  const ip = clientIpFromHeaders(req.headers) ?? "unknown";
  if (!hitLimit(`order-new:${ip}`, 10, 3600)) {
    return new NextResponse("Too many drafts started. Please try again later.", { status: 429 });
  }
  const searchParams = new URL(req.url).searchParams;
  const slug = searchParams.get("product") ?? "";
  const product = await db.product.findUnique({ where: { slug } });
  if (!product || !product.active) return NextResponse.redirect(`${origin}/remembered`);

  const offered = (product.options ?? {}) as ProductOptions;
  const selectedVariants = Object.fromEntries(
    VARIANT_GROUPS.flatMap((group) => {
      const value = searchParams.get(group.key);
      return value && offered[group.list]?.some((choice) => choice.key === value) ? [[group.key, value]] : [];
    }),
  );
  const sourcePersonId = searchParams.get("personId");
  let sourceOptions = {};
  if (sourcePersonId) {
    const user = await getSessionUser();
    const allowOtherPeople = product.pathway === "REMEMBERED" || product.layout === "wedding";
    const source = user ? await savedDraftForPerson(user.id, sourcePersonId, allowOtherPeople) : null;
    if (!source) return NextResponse.redirect(`${origin}/shop/${product.slug}`);
    sourceOptions = source.options;
  }

  const token = randomToken(24);
  await db.order.create({
    data: {
      guestToken: token,
      items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: { ...sourceOptions, ...selectedVariants } } },
    },
  });
  return NextResponse.redirect(`${origin}/order/${token}?step=1`);
}
