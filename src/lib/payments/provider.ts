import { db } from "@/lib/db";

export type PaymentSettings = {
  provider: string;
  currency: string;
  defaultPriceKes: number;
  tillNumber: string | null;
  storeNumber: string | null;
  paybillNumber: string | null;
  businessName: string | null;
  accountRef: string | null;
  instructions: string | null;
  verificationMode: "MANUAL" | "AUTO_CODE" | "WEBHOOK";
};

const DEFAULTS: PaymentSettings = {
  provider: "manual_mpesa",
  currency: "KES",
  defaultPriceKes: 750,
  tillNumber: null,
  storeNumber: null,
  paybillNumber: null,
  businessName: "Family Compass",
  accountRef: null,
  instructions:
    "Send the exact amount to our M-Pesa Till, then paste the M-Pesa confirmation code below. Payments are verified within a few hours.",
  verificationMode: "MANUAL",
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await db.paymentSettings.findUnique({ where: { scope: "global" } });
  if (!row) return DEFAULTS;
  return {
    provider: row.provider,
    currency: row.currency,
    defaultPriceKes: row.defaultPriceKes,
    tillNumber: row.tillNumber,
    storeNumber: row.storeNumber,
    paybillNumber: row.paybillNumber,
    businessName: row.businessName,
    accountRef: row.accountRef,
    instructions: row.instructions,
    verificationMode: row.verificationMode,
  };
}

export type CheckoutInstruction = {
  mode: "manual" | "stk" | "redirect";
  /** manual: how to pay + what to enter afterwards */
  payTo?: { label: string; value: string }[];
  note?: string;
  redirectUrl?: string;
};

export interface PaymentProvider {
  readonly id: string;
  /** Produce the on-screen checkout instructions for a pending payment. */
  checkout(input: {
    reference: string;
    amountKes: number;
    settings: PaymentSettings;
  }): Promise<CheckoutInstruction>;
  /** Verify an inbound webhook body; return the matched reference + ok, or null. */
  verifyWebhook?(headers: Headers, body: string): Promise<{ reference: string; ok: boolean } | null>;
}
