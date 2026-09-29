import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/rbac";
import { fulfilDraft } from "@/lib/orders";
import { publicOrigin } from "@/lib/origin";

/**
 * Account step. Signed-out visitors go to sign-in and come straight back here;
 * once signed in the draft becomes family data and the deposit opens.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = await publicOrigin();
  const user = await getSessionUser();
  if (!user) {
    const back = encodeURIComponent(`/order/${token}/finish`);
    return NextResponse.redirect(`${origin}/login?callbackUrl=${back}`);
  }
  const result = await fulfilDraft(user.id, token);
  if (!result) return NextResponse.redirect(`${origin}/remembered`);
  return NextResponse.redirect(`${origin}/pay/${result.paymentId}`);
}
