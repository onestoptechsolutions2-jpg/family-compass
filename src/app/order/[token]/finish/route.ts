import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/rbac";
import { fulfilDraft } from "@/lib/orders";
import { publicOrigin } from "@/lib/origin";
import { userConsentState } from "@/lib/consent";

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

  // A new customer has not accepted the policy yet, and the app sends them to
  // /consent without remembering where they were going. Route them there
  // ourselves, with the payment page as the destination, so the sale is not lost.
  const pay = `/pay/${result.paymentId}`;
  if ((await userConsentState(user.id)).stale) {
    return NextResponse.redirect(`${origin}/consent?next=${encodeURIComponent(pay)}`);
  }
  return NextResponse.redirect(`${origin}${pay}`);
}
