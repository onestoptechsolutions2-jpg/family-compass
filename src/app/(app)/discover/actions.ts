"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { personalWorkspaceId } from "@/lib/workspace";
import { getPaymentSettings } from "@/lib/payments";
import { paymentReference } from "@/lib/slug";
import {
  searchDirectory,
  previewSummary,
  teaserRows,
  type DirectoryQuery,
  type TeaserRow,
} from "@/lib/discovery";

const querySchema = z.object({
  name: z.string().trim().max(120).optional(),
  clan: z.string().trim().max(120).optional(),
  community: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  birthYear: z.coerce.number().int().min(1000).max(2100).optional(),
});

export type DeepSearchPreview = {
  ok: boolean;
  error?: string;
  count: number;
  teasers: TeaserRow[];
  clans: string[];
  decades: string[];
  priceKes: number;
  currency: string;
  /** echoed back so the caller can hand these to startDeepSearch unchanged */
  query: Record<string, string>;
};

/**
 * Free preview for the deep-search overlay — runs the directory search and
 * returns teaser rows (no surnames, no tree, no contact) plus the unlock price.
 * The full result lives behind payment via startDeepSearch.
 */
export async function previewDeepSearch(raw: {
  name?: string;
  clan?: string;
  community?: string;
  region?: string;
  birthYear?: string | number;
}): Promise<DeepSearchPreview> {
  await requireUser();
  const settings = await getPaymentSettings();
  const empty = { count: 0, teasers: [], clans: [], decades: [], priceKes: settings.deepSearchPriceKes, currency: settings.currency, query: {} };

  const parsed = querySchema.safeParse({
    name: raw.name || undefined,
    clan: raw.clan || undefined,
    community: raw.community || undefined,
    region: raw.region || undefined,
    birthYear: raw.birthYear || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Check your search terms", ...empty };
  const q = parsed.data;
  if (!q.name && !q.clan && !q.community) {
    return { ok: false, error: "Enter at least a name, clan or community", ...empty };
  }

  const candidates = await searchDirectory(q as DirectoryQuery);
  const summary = previewSummary(candidates);
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) if (v != null && v !== "") query[k] = String(v);

  return {
    ok: true,
    count: candidates.length,
    teasers: teaserRows(candidates),
    clans: summary.clans.slice(0, 6),
    decades: summary.decades.sort(),
    priceKes: settings.deepSearchPriceKes,
    currency: settings.currency,
    query,
  };
}

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
