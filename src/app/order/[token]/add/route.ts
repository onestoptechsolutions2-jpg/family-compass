import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/rbac";
import { addGuestDraftToCart } from "@/lib/cart";
import { publicOrigin } from "@/lib/origin";

/**
 * Add to cart. An account is needed first, so a signed-out visitor goes to
 * sign-in and comes straight back here; the draft they built is kept, so
 * nothing they typed is lost on the way.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = await publicOrigin();
  const user = await getSessionUser();
  if (!user) {
    const back = encodeURIComponent(`/order/${token}/add`);
    return NextResponse.redirect(`${origin}/login?callbackUrl=${back}`);
  }
  const cartId = await addGuestDraftToCart(user.id, token);
  if (!cartId) return NextResponse.redirect(`${origin}/shop`);
  return NextResponse.redirect(`${origin}/cart?added=1`);
}
