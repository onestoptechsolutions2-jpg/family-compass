import { NextResponse, type NextRequest } from "next/server";

import { consumeSignInToken } from "@/lib/claims";
import { startDbSession } from "@/lib/session";
import { getSessionUser } from "@/lib/rbac";

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
  const origin = new URL(_req.url).origin;

  const current = await getSessionUser();
  if (current) return NextResponse.redirect(new URL("/app", origin));

  const userId = await consumeSignInToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=BadLink", origin));
  }

  await startDbSession(userId);
  return NextResponse.redirect(new URL("/app", origin));
}
