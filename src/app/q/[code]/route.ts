import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";

/** Permanent short address printed on plaques: redirects to wherever the code points now. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = await publicOrigin();
  const qr = await db.qrCode.findUnique({
    where: { code },
    select: {
      active: true,
      memorial: { select: { slug: true, published: true } },
      sharedView: { select: { slug: true, revoked: true, expiresAt: true } },
    },
  });
  if (qr?.active && qr.memorial?.published) {
    return NextResponse.redirect(`${origin}/m/${qr.memorial.slug}`);
  }
  const v = qr?.sharedView;
  if (qr?.active && v && !v.revoked && (!v.expiresAt || v.expiresAt > new Date())) {
    return NextResponse.redirect(`${origin}/s/${v.slug}`);
  }
  return NextResponse.redirect(`${origin}/`);
}
