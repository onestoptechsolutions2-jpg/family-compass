import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { sessionCookieName } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The client calls this once it notices it is running as an installed PWA
 * (standalone display-mode) or catches the `appinstalled` event. Marks the
 * current DB session so admin can count installs per device. Best-effort.
 */
export async function POST() {
  try {
    const token = (await cookies()).get(sessionCookieName())?.value;
    if (!token) return NextResponse.json({ ok: false }, { status: 401 });

    const row = await db.session.findUnique({
      where: { sessionToken: token },
      select: { id: true, standalone: true },
    });
    if (!row) return NextResponse.json({ ok: false }, { status: 401 });

    if (!row.standalone) {
      await db.session.update({
        where: { id: row.id },
        data: { standalone: true, installedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
