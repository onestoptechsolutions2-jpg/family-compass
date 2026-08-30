import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { getPaymentSettings, getProvider } from "@/lib/payments";
import { fulfilPayment } from "@/lib/payments/fulfil";
import { parseStkCallback, DARAJA_PROVIDER_ID } from "@/lib/payments/daraja";
import { PaymentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Inbound payment callbacks.
 *  - mpesa_daraja : Safaricom STK Push result callback (matched by CheckoutRequestID)
 *  - other        : generic aggregator webhooks via provider.verifyWebhook (matched by reference)
 * No-op unless PaymentSettings.provider matches the path segment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const settings = await getPaymentSettings();

  if (settings.provider !== providerId || providerId === "manual_mpesa") {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "ignored" }, { status: 200 });
  }

  const body = await req.text();

  // ---- Daraja STK Push callback ----
  if (providerId === DARAJA_PROVIDER_ID) {
    const cb = parseStkCallback(body);
    if (!cb?.checkoutRequestId) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "unparseable" }, { status: 200 });
    }
    const payment = await db.payment.findFirst({
      where: { checkoutRequestId: cb.checkoutRequestId },
      select: { id: true, status: true },
    });
    if (!payment) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "unknown checkout" }, { status: 200 });
    }

    if (cb.resultCode === 0) {
      await fulfilPayment(payment.id, { note: "M-Pesa STK", providerRef: cb.receipt ?? null });
    } else if (payment.status !== PaymentStatus.PAID) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REJECTED,
          resultCode: cb.resultCode,
          resultDesc: cb.resultDesc,
          rejectionReason: cb.resultDesc || "Payment not completed",
        },
      });
    }
    // Safaricom expects a 200 with this shape
    return NextResponse.json({ ResultCode: 0, ResultDesc: "ok" }, { status: 200 });
  }

  // ---- generic aggregator webhook ----
  const provider = getProvider(providerId);
  if (!provider.verifyWebhook) {
    return NextResponse.json({ ok: false, error: "not implemented" }, { status: 501 });
  }
  const result = await provider.verifyWebhook(req.headers, body);
  if (!result?.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const payment = await db.payment.findUnique({
    where: { reference: result.reference },
    select: { id: true },
  });
  if (!payment) return NextResponse.json({ ok: false, error: "unknown reference" }, { status: 404 });

  await fulfilPayment(payment.id, { note: `webhook:${providerId}` });
  return NextResponse.json({ ok: true });
}
