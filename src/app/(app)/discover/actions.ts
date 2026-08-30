"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { personalWorkspaceId } from "@/lib/workspace";
import { getPaymentSettings } from "@/lib/payments";
import { paymentReference } from "@/lib/slug";
import { searchDirectory, type DirectoryQuery } from "@/lib/discovery";

const querySchema = z.object({
  name: z.string().trim().max(120).optional(),
  clan: z.string().trim().max(120).optional(),
  community: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  birthYear: z.coerce.number().int().min(1000).max(2100).optional(),
});

export async function startDeepSearch(formData: FormData) {
  const me = await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = querySchema.parse({
    name: raw.name || undefined,
    clan: raw.clan || undefined,
    community: raw.community || undefined,
    region: raw.region || undefined,
    birthYear: raw.birthYear || undefined,
  });
  const query: DirectoryQuery = parsed;
  if (!parsed.name && !parsed.clan && !parsed.community) {
    throw new Error("Enter at least a name, clan or community");
  }

  const candidates = await searchDirectory(query);
  const settings = await getPaymentSettings();
  const workspaceId = await personalWorkspaceId(me.id, me.name ?? me.email);

  const payment = await db.payment.create({
    data: {
      workspaceId,
      userId: me.id,
      provider: settings.provider,
      kind: PaymentKind.DEEP_SEARCH,
      creditsGranted: 0,
      amountKes: settings.deepSearchPriceKes,
      currency: settings.currency,
      reference: paymentReference(),
      status: PaymentStatus.PENDING,
    },
    select: { id: true },
  });

  const search = await db.deepSearch.create({
    data: {
      requesterId: me.id,
      query: query as object,
      resultCount: candidates.length,
      status: "PREVIEW",
      paymentId: payment.id,
    },
    select: { id: true },
  });
  void search;

  redirect(`/pay/${payment.id}`);
}
