"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VerificationMode } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";

const schema = z.object({
  provider: z.string().trim().min(1).default("manual_mpesa"),
  currency: z.string().trim().min(1).max(8).default("KES"),
  defaultPriceKes: z.coerce.number().int().min(1).max(1_000_000).default(750),
  keeperPriceKes: z.coerce.number().int().min(1).max(10_000_000).default(3000),
  priceFreeGenerations: z.coerce.number().int().min(0).max(20).default(4),
  priceFreeNodes: z.coerce.number().int().min(0).max(100000).default(60),
  pricePerGenerationKes: z.coerce.number().int().min(0).max(1_000_000).default(150),
  pricePerNodeKes: z.coerce.number().int().min(0).max(100000).default(8),
  deepSearchPriceKes: z.coerce.number().int().min(1).max(1_000_000).default(300),
  researchBaseKes: z.coerce.number().int().min(0).max(100_000_000).default(5000),
  researchPerGenerationKes: z.coerce.number().int().min(0).max(10_000_000).default(1500),
  researchPerNodeKes: z.coerce.number().int().min(0).max(1_000_000).default(200),
  businessName: z.string().trim().max(120).optional(),
  tillNumber: z.string().trim().max(40).optional(),
  storeNumber: z.string().trim().max(40).optional(),
  paybillNumber: z.string().trim().max(40).optional(),
  accountRef: z.string().trim().max(60).optional(),
  instructions: z.string().trim().max(2000).optional(),
  verificationMode: z.enum(VerificationMode).default(VerificationMode.MANUAL),
});

export async function updatePaymentSettings(formData: FormData) {
  await requirePlatformAdmin();
  const d = schema.parse(Object.fromEntries(formData));
  const data = {
    provider: d.provider,
    currency: d.currency,
    defaultPriceKes: d.defaultPriceKes,
    keeperPriceKes: d.keeperPriceKes,
    priceFreeGenerations: d.priceFreeGenerations,
    priceFreeNodes: d.priceFreeNodes,
    pricePerGenerationKes: d.pricePerGenerationKes,
    pricePerNodeKes: d.pricePerNodeKes,
    deepSearchPriceKes: d.deepSearchPriceKes,
    researchBaseKes: d.researchBaseKes,
    researchPerGenerationKes: d.researchPerGenerationKes,
    researchPerNodeKes: d.researchPerNodeKes,
    businessName: d.businessName || null,
    tillNumber: d.tillNumber || null,
    storeNumber: d.storeNumber || null,
    paybillNumber: d.paybillNumber || null,
    accountRef: d.accountRef || null,
    instructions: d.instructions || null,
    verificationMode: d.verificationMode,
  };
  await db.paymentSettings.upsert({
    where: { scope: "global" },
    update: data,
    create: { scope: "global", ...data },
  });
  revalidatePath("/admin/settings");
}
