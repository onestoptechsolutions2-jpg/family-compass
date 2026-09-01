import { NextResponse, type NextRequest } from "next/server";

import { consumeLoginToken } from "@/lib/login-token";
import { startDbSession } from "@/lib/session";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { homePathForUser } from "@/lib/home";

export const dynamic = "force-dynamic";

/** One-time passwordless sign-in link (super-admin bootstrap etc.). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // `req.url` is the internal URL behind a proxy — use the forwarded origin.
  const origin = await publicOrigin();

  const current = await getSessionUser();
  if (current) return NextResponse.redirect(new URL(await homePathForUser(current.id), origin));

  const userId = await consumeLoginToken(token);
  if (!userId) return NextResponse.redirect(new URL("/login?error=BadLink", origin));

  await startDbSession(userId);
  return NextResponse.redirect(new URL(await homePathForUser(userId), origin));
}
