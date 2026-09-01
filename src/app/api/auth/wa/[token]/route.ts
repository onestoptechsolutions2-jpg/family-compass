import { NextResponse, type NextRequest } from "next/server";

import { consumeSignInToken } from "@/lib/claims";
import { startDbSession } from "@/lib/session";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { homePathForUser } from "@/lib/home";

export const dynamic = "force-dynamic";

/**
 * One-time WhatsApp sign-in link. The tree admin sends this to an approved
 * claimant over WhatsApp; opening it establishes a session — no password,
 * no email.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // Behind a reverse proxy `req.url` is the internal http://localhost URL —
  // resolve the public origin from the forwarded headers instead.
  const origin = await publicOrigin();

  const current = await getSessionUser();
  if (current) {
    // Already signed in — don't burn the token; land them on their own home.
    return NextResponse.redirect(new URL(await homePathForUser(current.id), origin));
  }

  const claim = await consumeSignInToken(token);
  if (!claim) {
    return NextResponse.redirect(new URL("/login?error=BadLink", origin));
  }

  await startDbSession(claim.userId);
  // Always their own profile, centred on them, with the first-run wizard.
  const dest = claim.personId
    ? `/trees/${claim.treeId}/people/${claim.personId}?welcome=1`
    : await homePathForUser(claim.userId, { welcome: true });
  return NextResponse.redirect(new URL(dest, origin));
}
