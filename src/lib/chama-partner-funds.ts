// Server code (the app and the worker). Not "server-only": that package refuses to load in the
// worker. The token is safe anyway: only NEXT_PUBLIC_ settings ever reach a browser.

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { normalisePhone } from "@/lib/referral-rules";
import { branchesFor, readTotals, toChamaPayout } from "@/lib/chama-partner-rules";
import { createFund, getFund, newWebhookSecret, partnerEnabled } from "@/lib/chama-partner";
import type { FundDestination } from "@/lib/fund-destination";

/** Where Chama posts this app's fund events. */
export const chamaWebhookPath = "/api/partners/chama/webhook";

/** `retry`: Chama could not be reached or was down, so trying again later may work. */
export type LinkOutcome = { linked: true } | { linked: false; reason: string; retry?: boolean };

/**
 * Move a family's funeral fund onto Chama, where mourners give by M-Pesa prompt and every gift
 * records itself. The family's own account stays the only place the money can be paid out to.
 * If Chama cannot take it (switched off, wallets off, down), the fund simply stays as it is: on
 * the family's own M-Pesa, confirmed by hand.
 */
export async function linkFundToChama(
  fundId: string,
  chair: { name: string; phone: string },
  family: { spouse?: string; children?: string } = {},
): Promise<LinkOutcome> {
  if (!partnerEnabled()) return { linked: false, reason: "Automatic M-Pesa is not switched on." };
  const fund = await db.chamaFund.findUnique({
    where: { id: fundId },
    select: {
      id: true, label: true, targetKes: true, memorialId: true, partnerFundId: true,
      payKind: true, payNumber: true, payAccount: true, payName: true,
      memorial: { select: { person: { select: { names: { where: { preferred: true }, take: 1, select: { first: true, surname: true } } } } } },
    },
  });
  if (!fund?.memorialId) return { linked: false, reason: "There is no memorial for this fund." };
  if (fund.partnerFundId) return { linked: true };
  if (!fund.payKind || !fund.payNumber || !fund.payName) return { linked: false, reason: "Add where the money goes first." };
  const phone = normalisePhone(chair.phone);
  if (!phone) return { linked: false, reason: "The committee chair needs a Kenyan mobile number." };

  const n = fund.memorial?.person.names[0];
  const deceasedName = [n?.first, n?.surname].filter(Boolean).join(" ") || fund.label;
  const branches = branchesFor(family);
  const destination = { payKind: fund.payKind, payNumber: fund.payNumber, payAccount: fund.payAccount, payName: fund.payName } as FundDestination;
  const res = await createFund({
    ref: fund.memorialId,
    deceasedName,
    name: fund.label.replace(/^Welfare fund — /, "Funeral fund — "),
    targetKes: fund.targetKes,
    committee: [{ name: chair.name.trim().slice(0, 120) || "Committee chair", phone: `0${phone.slice(3)}`, role: "chair" }],
    branches,
    payout: toChamaPayout(destination),
    webhookUrl: `${await publicOrigin()}${chamaWebhookPath}`,
  });
  if (!res.ok) return { linked: false, reason: res.unavailable ? "Automatic M-Pesa is not available yet; contributions stay on your own M-Pesa." : res.error, retry: res.unavailable };

  const f = res.data;
  const totals = readTotals(f as unknown as Record<string, unknown>);
  // the secret comes only with the first create; if that answer was lost, ask Chama for a new one
  let secret = f.webhookSecret;
  if (!secret) {
    const fresh = await newWebhookSecret(f.fundId);
    if (fresh.ok) secret = fresh.data.webhookSecret;
  }
  await db.chamaFund.update({
    where: { id: fund.id },
    data: {
      partnerFundId: f.fundId,
      partnerGiveUrl: f.giveUrl,
      // without one, Chama's events for this fund cannot be trusted; totals are then read instead
      ...(secret ? { partnerSecret: secret } : {}),
      branches: f.branches?.length ? f.branches : branches,
      partnerStatus: f.status,
      partnerTotalKes: totals.total ?? 0,
      partnerGiftCount: totals.giftCount ?? 0,
      partnerSyncedAt: new Date(),
    },
  });
  return { linked: true };
}

/** Refresh a Chama-run fund's totals (for the committee's page). Best effort: stale numbers beat an error. */
export async function refreshFromChama(fundId: string): Promise<void> {
  const fund = await db.chamaFund.findUnique({ where: { id: fundId }, select: { partnerFundId: true, partnerSyncedAt: true } });
  if (!fund?.partnerFundId) return;
  // a webhook usually keeps this fresh; read at most once a minute
  if (fund.partnerSyncedAt && Date.now() - fund.partnerSyncedAt.getTime() < 60_000) return;
  const res = await getFund(fund.partnerFundId);
  if (!res.ok) return;
  const t = readTotals(res.data as unknown as Record<string, unknown>);
  await db.chamaFund.update({
    where: { id: fundId },
    data: {
      partnerStatus: res.data.status,
      ...(t.total !== null ? { partnerTotalKes: t.total } : {}),
      ...(t.giftCount !== null ? { partnerGiftCount: t.giftCount } : {}),
      partnerByBranch: t.byBranch,
      ...(res.data.giveUrl ? { partnerGiveUrl: res.data.giveUrl } : {}),
      partnerSyncedAt: new Date(),
    },
  });
}

/**
 * For a page that shows a fund's totals: never wait on Chama while the page loads. If the totals
 * are over a minute old (a missed webhook), the worker fetches them; the page shows what it has.
 */
export async function refreshFromChamaLater(fundId: string): Promise<void> {
  const fund = await db.chamaFund.findUnique({ where: { id: fundId }, select: { partnerFundId: true, partnerSyncedAt: true } });
  if (!fund?.partnerFundId) return;
  if (fund.partnerSyncedAt && Date.now() - fund.partnerSyncedAt.getTime() < 60_000) return;
  try {
    const { enqueue, QUEUE } = await import("@/lib/queue");
    await enqueue(QUEUE.chamaRefresh, { fundId }, { singletonKey: fundId, singletonSeconds: 60 });
  } catch (err) {
    console.error("[chama] could not queue a refresh", err);
  }
}
