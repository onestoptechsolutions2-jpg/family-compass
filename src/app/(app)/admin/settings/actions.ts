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
  await db.paymentSettings.upsert({
    where: { scope: "global" },
    update: {
      provider: d.provider,
      currency: d.currency,
      defaultPriceKes: d.defaultPriceKes,
      businessName: d.businessName || null,
      tillNumber: d.tillNumber || null,
      storeNumber: d.storeNumber || null,
      paybillNumber: d.paybillNumber || null,
      accountRef: d.accountRef || null,
      instructions: d.instructions || null,
      verificationMode: d.verificationMode,
    },
    create: {
      scope: "global",
      provider: d.provider,
      currency: d.currency,
      defaultPriceKes: d.defaultPriceKes,
      businessName: d.businessName || null,
      tillNumber: d.tillNumber || null,
      storeNumber: d.storeNumber || null,
      paybillNumber: d.paybillNumber || null,
      accountRef: d.accountRef || null,
      instructions: d.instructions || null,
      verificationMode: d.verificationMode,
    },
  });
  revalidatePath("/admin/settings");
}
