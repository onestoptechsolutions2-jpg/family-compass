import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Store (or refresh) a Web Push subscription for the signed-in user. */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? "");
  const p256dh = String(body.keys?.p256dh ?? "");
  const auth = String(body.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: me.id, endpoint, p256dh, auth, ua, lastOkAt: new Date() },
    update: { userId: me.id, p256dh, auth, ua, lastOkAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

/** Remove a subscription (client called `unsubscribe()`). */
export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  let endpoint = "";
  try {
    endpoint = String((await req.json())?.endpoint ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (endpoint) {
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } });
  }
  return NextResponse.json({ ok: true });
}
