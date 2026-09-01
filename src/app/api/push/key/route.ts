import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/rbac";
import { env, hasWebPush } from "@/lib/env";

export const dynamic = "force-dynamic";

/** The VAPID public key the client needs to subscribe. 204 when push is off. */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasWebPush) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ key: env.VAPID_PUBLIC_KEY });
}
