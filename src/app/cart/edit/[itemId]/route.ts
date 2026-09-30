import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/rbac";
import { startEditItem } from "@/lib/cart";
import { publicOrigin } from "@/lib/origin";

/** Change an item already in the cart: open it in the wizard, with everything as it was. */
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const origin = await publicOrigin();
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login?callbackUrl=${encodeURIComponent("/cart")}`);
  const token = await startEditItem(user.id, itemId);
  if (!token) return NextResponse.redirect(`${origin}/cart`);
  return NextResponse.redirect(`${origin}/order/${token}?step=1`);
}
