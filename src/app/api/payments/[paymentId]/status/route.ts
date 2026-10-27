import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { hitLimit } from "@/lib/api/rate-limit";
import { settleStk, STK_GRACE_MS } from "@/lib/payments/reconcile";

export const dynamic = "force-dynamic";

/**
 * Where the customer's own payment stands, for the pay page to follow by itself. While an
 * M-Pesa prompt is still open past its grace period, this also asks M-Pesa (at most every
 * 15 seconds a payment), so a lost callback does not keep the customer waiting for the sweep.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const p = await db.payment.findFirst({ where: { id: paymentId, userId: me.id }, select: { status: true, updatedAt: true } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let status = p.status;
  if (status === PaymentStatus.AWAITING_STK && Date.now() - p.updatedAt.getTime() > STK_GRACE_MS / 3 && hitLimit(`stk-check:${paymentId}`, 1, 15)) {
    try {
      await settleStk(paymentId);
      status = (await db.payment.findUnique({ where: { id: paymentId }, select: { status: true } }))?.status ?? status;
    } catch (err) {
      console.error("[pay] status check failed", err);
    }
  }
  return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
