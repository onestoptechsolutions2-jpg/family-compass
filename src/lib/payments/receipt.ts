import { GenerationKind, PaymentKind } from "@prisma/client";

import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payments";
import { GENERATION_LABELS } from "@/lib/pricing";

/** A one-line description of what a payment bought. */
export function receiptItemLabel(p: {
  kind: PaymentKind;
  generationJob?: { kind: GenerationKind } | null;
}): string {
  if (p.generationJob) {
    return `${GENERATION_LABELS[p.generationJob.kind] ?? "Download"} — clean copy`;
  }
  switch (p.kind) {
    case PaymentKind.SINGLE:
      return "One download credit";
    case PaymentKind.BUNDLE_5:
      return "5 download credits";
    case PaymentKind.BUNDLE_15:
      return "15 download credits";
    case PaymentKind.KEEPER:
      return "Family plan — one year of unlimited downloads";
    case PaymentKind.DEEP_SEARCH:
      return "Cross-family deep search";
    case PaymentKind.RESEARCH_PARTNER:
      return "Research engagement";
    case PaymentKind.CHAMA_CONTRIBUTION:
      return "Welfare / chama contribution";
    default:
      return "Family Compass service";
  }
}

export async function getReceipt(reference: string) {
  const p = await db.payment.findUnique({
    where: { reference },
    select: {
      reference: true,
      kind: true,
      amountKes: true,
      currency: true,
      mpesaCode: true,
      payerPhone: true,
      provider: true,
      status: true,
      verifiedAt: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
      tree: { select: { name: true } },
      generationJob: { select: { kind: true } },
      workspace: { select: { name: true, memberships: { select: { userId: true } } } },
    },
  });
  if (!p) return null;

  const settings = await getPaymentSettings();
  return {
    reference: p.reference,
    status: p.status,
    item: receiptItemLabel(p),
    amountKes: p.amountKes,
    currency: p.currency,
    mpesaCode: p.mpesaCode,
    payerPhone: p.payerPhone,
    provider: p.provider,
    paidAt: p.verifiedAt ?? p.createdAt,
    payer: p.user.name ?? p.user.email,
    treeName: p.tree?.name ?? null,
    business: settings.businessName ?? "Family Compass",
    userId: p.userId,
    memberIds: p.workspace.memberships.map((m) => m.userId),
  };
}
