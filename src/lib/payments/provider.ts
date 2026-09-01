import { db } from "@/lib/db";

export type PaymentSettings = {
  provider: string;
  currency: string;
  defaultPriceKes: number;
  keeperPriceKes: number;
  memorialPassKes: number;
  memorialPassDays: number;
  priceFreeGenerations: number;
  priceFreeNodes: number;
  pricePerGenerationKes: number;
  pricePerNodeKes: number;
  deepSearchPriceKes: number;
  researchBaseKes: number;
  researchPerGenerationKes: number;
  researchPerNodeKes: number;
  tillNumber: string | null;
  storeNumber: string | null;
  paybillNumber: string | null;
  businessName: string | null;
  accountRef: string | null;
  instructions: string | null;
  verificationMode: "MANUAL" | "AUTO_CODE" | "WEBHOOK";
  bankTransfer: {
    bank: string;
    branch: string | null;
    accountNo: string;
    accountName: string;
  } | null;
};

const DEFAULTS: PaymentSettings = {
  provider: "manual_mpesa",
  currency: "KES",
  defaultPriceKes: 750,
  keeperPriceKes: 3000,
  memorialPassKes: 1500,
  memorialPassDays: 120,
  priceFreeGenerations: 4,
  priceFreeNodes: 60,
  pricePerGenerationKes: 150,
  pricePerNodeKes: 8,
  deepSearchPriceKes: 300,
  researchBaseKes: 5000,
  researchPerGenerationKes: 1500,
  researchPerNodeKes: 200,
  tillNumber: null,
  storeNumber: null,
  paybillNumber: null,
  businessName: "Family Compass",
  accountRef: null,
  instructions:
    "Send the exact amount to our M-Pesa Till, then paste the M-Pesa confirmation code below. Payments are verified within a few hours.",
  verificationMode: "MANUAL",
  bankTransfer: null,
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await db.paymentSettings.findUnique({ where: { scope: "global" } });
  if (!row) return DEFAULTS;
  return {
    provider: row.provider,
    currency: row.currency,
    defaultPriceKes: row.defaultPriceKes,
    keeperPriceKes: row.keeperPriceKes,
    memorialPassKes: row.memorialPassKes,
    memorialPassDays: row.memorialPassDays,
    priceFreeGenerations: row.priceFreeGenerations,
    priceFreeNodes: row.priceFreeNodes,
    pricePerGenerationKes: row.pricePerGenerationKes,
    pricePerNodeKes: row.pricePerNodeKes,
    deepSearchPriceKes: row.deepSearchPriceKes,
    researchBaseKes: row.researchBaseKes,
    researchPerGenerationKes: row.researchPerGenerationKes,
    researchPerNodeKes: row.researchPerNodeKes,
    tillNumber: row.tillNumber,
    storeNumber: row.storeNumber,
    paybillNumber: row.paybillNumber,
    businessName: row.businessName,
    accountRef: row.accountRef,
    instructions: row.instructions,
    verificationMode: row.verificationMode,
    bankTransfer: parseBankTransfer(row.config),
  };
}

function parseBankTransfer(config: unknown): PaymentSettings["bankTransfer"] {
  const bt = (config as { bankTransfer?: Record<string, unknown> } | null)?.bankTransfer;
  if (!bt || typeof bt.bank !== "string" || typeof bt.accountNo !== "string") return null;
  return {
    bank: bt.bank,
    branch: typeof bt.branch === "string" ? bt.branch : null,
    accountNo: bt.accountNo,
    accountName: typeof bt.accountName === "string" ? bt.accountName : "",
  };
}

export async function generationBaseKes(): Promise<Record<string, number>> {
  const rows = await db.generationPricing.findMany();
  return Object.fromEntries(rows.map((r) => [r.kind, r.baseKes]));
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
