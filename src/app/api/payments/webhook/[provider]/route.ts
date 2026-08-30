import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { getPaymentSettings } from "@/lib/payments";
import { getProvider } from "@/lib/payments";
import { CreditReason, PaymentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Inbound payment webhook for aggregator providers (IntaSend / Paystack STK
 * push). No-op until such a provider is configured; the provider adapter is
 * responsible for signature verification in `verifyWebhook`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const settings = await getPaymentSettings();
  if (settings.provider !== providerId || providerId === "manual_mpesa") {
    return NextResponse.json({ ok: false, error: "provider not active" }, { status: 501 });
  }

  const provider = getProvider(providerId);
  if (!provider.verifyWebhook) {
    return NextResponse.json({ ok: false, error: "not implemented" }, { status: 501 });
  }

  const body = await req.text();
  const result = await provider.verifyWebhook(req.headers, body);
  if (!result?.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const payment = await db.payment.findUnique({
    where: { reference: result.reference },
    select: { id: true, status: true, workspaceId: true, creditsGranted: true },
  });
  if (!payment) return NextResponse.json({ ok: false, error: "unknown reference" }, { status: 404 });
  if (payment.status === PaymentStatus.PAID) return NextResponse.json({ ok: true });

  await db.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.PAID, verifiedAt: new Date() },
  });
  if (payment.creditsGranted > 0) {
    await grantCredits(payment.workspaceId, payment.creditsGranted, {
      reason: CreditReason.PURCHASE,
      paymentId: payment.id,
      note: `webhook:${providerId}`,
    });
  }
  return NextResponse.json({ ok: true });
}
