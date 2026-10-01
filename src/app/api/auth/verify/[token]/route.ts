import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { consumeLoginToken } from "@/lib/login-token";
import { publicOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/** The link in the "confirm your email" message. It proves the mailbox is theirs; it does not sign anyone in. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = await publicOrigin();
  const userId = await consumeLoginToken(token, ["verify"]);
  if (!userId) return NextResponse.redirect(new URL("/login?error=BadLink", origin));
  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return NextResponse.redirect(new URL("/shop?confirmed=1", origin));
}
