import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { hitLimit } from "@/lib/api/rate-limit";

/**
 * Is this saved design still open? Used to offer "continue your design" to someone
 * who comes back on the same phone. It says only yes or no, and only to someone
 * who already holds the private link.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!hitLimit(`draft-check:${ip}`, 60, 60)) return NextResponse.json({ ok: false }, { status: 429 });
  const { token } = await params;
  const order = await db.order.findUnique({ where: { guestToken: token }, select: { status: true, userId: true, notes: true } });
  const ok = Boolean(order && order.status === OrderStatus.DRAFT && !order.userId && !order.notes?.startsWith("merged:"));
  return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
