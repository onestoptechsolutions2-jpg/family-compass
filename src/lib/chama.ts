import { db } from "@/lib/db";
import { randomToken } from "@/lib/slug";
import { emitTreeEvent } from "@/lib/webhooks";

/**
 * Family "chama" — a welfare / savings group attached to a tree. This is the
 * trimmed integration of the standalone chama platform: contributions collected
 * through the existing PaymentProvider (manual M-Pesa Till + Daraja STK), no
 * aggregator. Loans / fines / merry-go-round rotations are out of scope for now
 * but the schema leaves room (ChamaPurpose, ChamaRole).
 */

export type FundTotals = {
  confirmedKes: number;
  pledgedKes: number;
  contributors: number;
  targetKes: number | null;
  /** 0..1 against target, null when no target */
  progress: number | null;
};

/** Get or create the tree's default welfare chama. */
export async function ensureTreeChama(
  treeId: string,
  opts: { workspaceId: string; name?: string; createdById?: string | null },
): Promise<{ id: string }> {
  const existing = await db.chama.findFirst({
    where: { treeId, purpose: "WELFARE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing;

  const chama = await db.chama.create({
    data: {
      treeId,
      workspaceId: opts.workspaceId,
      name: opts.name?.trim() || "Family Welfare",
      purpose: "WELFARE",
      createdById: opts.createdById ?? null,
    },
    select: { id: true },
  });
  await emitTreeEvent(treeId, "chama.created", { chamaId: chama.id, purpose: "WELFARE" });
  return chama;
}

/** Open (or reuse) the welfare fund tied to a memorial. */
export async function ensureMemorialFund(
  treeId: string,
  memorialId: string,
  opts: { workspaceId: string; label: string; targetKes?: number | null; createdById?: string | null },
): Promise<{ token: string; fundId: string }> {
  const found = await db.chamaFund.findUnique({
    where: { memorialId },
    select: { id: true, publicToken: true },
  });
  if (found) return { token: found.publicToken, fundId: found.id };

  const chama = await ensureTreeChama(treeId, {
    workspaceId: opts.workspaceId,
    createdById: opts.createdById,
  });
  const publicToken = randomToken(12);
  const fund = await db.chamaFund.create({
    data: {
      chamaId: chama.id,
      label: opts.label.slice(0, 160),
      targetKes: opts.targetKes ?? null,
      memorialId,
      publicToken,
      createdById: opts.createdById ?? null,
    },
    select: { id: true },
  });
  await emitTreeEvent(treeId, "chama.fund_opened", {
    chamaId: chama.id,
    fundId: fund.id,
    memorialId,
    label: opts.label,
  });
  return { token: publicToken, fundId: fund.id };
}

export async function fundByToken(token: string) {
  return db.chamaFund.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      label: true,
      purposeNote: true,
      targetKes: true,
      status: true,
      chamaId: true,
      chama: { select: { treeId: true, name: true, currency: true } },
      memorial: { select: { slug: true, headline: true } },
    },
  });
}

export async function fundTotals(fundId: string): Promise<FundTotals> {
  const [confirmed, pledged, target] = await Promise.all([
    db.chamaContribution.aggregate({
      where: { fundId, status: "CONFIRMED" },
      _sum: { amountKes: true },
      _count: true,
    }),
    db.chamaContribution.aggregate({
      where: { fundId, status: "PLEDGED" },
      _sum: { amountKes: true },
    }),
    db.chamaFund.findUnique({ where: { id: fundId }, select: { targetKes: true } }),
  ]);
  const confirmedKes = confirmed._sum.amountKes ?? 0;
  const targetKes = target?.targetKes ?? null;
  return {
    confirmedKes,
    pledgedKes: pledged._sum.amountKes ?? 0,
    contributors: confirmed._count,
    targetKes,
    progress: targetKes ? Math.min(1, confirmedKes / targetKes) : null,
  };
}

/** A supporter records what they are sending (or have sent). Family confirms. */
export async function recordPledge(
  token: string,
  input: {
    name: string;
    phone?: string | null;
    amountKes: number;
    method?: "MPESA_MANUAL" | "CASH" | "OTHER";
    mpesaCode?: string | null;
    note?: string | null;
    ip?: string | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fund = await db.chamaFund.findUnique({
    where: { publicToken: token },
    select: { id: true, chamaId: true, status: true, chama: { select: { treeId: true } } },
  });
  if (!fund) return { ok: false, error: "not_found" };
  if (fund.status !== "OPEN") return { ok: false, error: "closed" };

  const name = input.name.trim().slice(0, 120);
  const amountKes = Math.round(input.amountKes);
  if (name.length < 2) return { ok: false, error: "name" };
  if (!Number.isFinite(amountKes) || amountKes < 1 || amountKes > 10_000_000) {
    return { ok: false, error: "amount" };
  }

  const c = await db.chamaContribution.create({
    data: {
      fundId: fund.id,
      chamaId: fund.chamaId,
      contributorName: name,
      phone: input.phone?.trim().slice(0, 30) || null,
      amountKes,
      method: input.method ?? "MPESA_MANUAL",
      mpesaCode: input.mpesaCode?.trim().slice(0, 20) || null,
      note: input.note?.trim().slice(0, 500) || null,
      ip: input.ip ?? null,
      status: "PLEDGED",
    },
    select: { id: true },
  });
  await emitTreeEvent(fund.chama.treeId, "chama.contribution_pledged", {
    fundId: fund.id,
    contributionId: c.id,
    name,
    amountKes,
    method: input.method ?? "MPESA_MANUAL",
  });
  return { ok: true, id: c.id };
}

/** Treasurer marks a pledge as received against the M-Pesa statement. */
export async function confirmContribution(
  treeId: string,
  contributionId: string,
  by: string,
  mpesaCode?: string | null,
): Promise<void> {
  const c = await db.chamaContribution.findFirst({
    where: { id: contributionId, chama: { treeId } },
    select: { id: true, status: true, fundId: true, amountKes: true, contributorName: true, mpesaCode: true },
  });
  if (!c || c.status === "CONFIRMED") return;
  await db.chamaContribution.update({
    where: { id: c.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedById: by,
      mpesaCode: mpesaCode?.trim().slice(0, 20) || undefined,
    },
  });
  await emitTreeEvent(treeId, "chama.contribution_confirmed", {
    fundId: c.fundId,
    contributionId: c.id,
    name: c.contributorName,
    amountKes: c.amountKes,
  });

  // mirror onto the linked external chama group, if any (best-effort)
  const link = await db.chamaLink.findUnique({ where: { treeId } });
  if (link?.pushWelfare) {
    const { pushWelfareContribution } = await import("@/lib/chama-api");
    await pushWelfareContribution(link, {
      amount: c.amountKes,
      reference: c.mpesaCode ?? c.id,
      note: `${c.contributorName} · welfare`,
    }).catch(() => {});
  }
}

export async function voidContribution(treeId: string, contributionId: string): Promise<void> {
  await db.chamaContribution.updateMany({
    where: { id: contributionId, chama: { treeId } },
    data: { status: "VOID" },
  });
}

export async function closeFund(treeId: string, fundId: string): Promise<void> {
  const fund = await db.chamaFund.findFirst({
    where: { id: fundId, chama: { treeId } },
    select: { id: true, status: true },
  });
  if (!fund || fund.status === "CLOSED") return;
  await db.chamaFund.update({
    where: { id: fund.id },
    data: { status: "CLOSED", closesAt: new Date() },
  });
  const totals = await fundTotals(fund.id);
  await emitTreeEvent(treeId, "chama.fund_closed", { fundId: fund.id, confirmedKes: totals.confirmedKes });
}

export async function reopenFund(treeId: string, fundId: string): Promise<void> {
  await db.chamaFund.updateMany({
    where: { id: fundId, chama: { treeId }, status: "CLOSED" },
    data: { status: "OPEN", closesAt: null },
  });
}

/** Recent contributions for the family view / public feed. */
export async function fundContributions(fundId: string, opts: { publicOnly?: boolean } = {}) {
  return db.chamaContribution.findMany({
    where: {
      fundId,
      ...(opts.publicOnly ? { status: "CONFIRMED" } : { status: { not: "VOID" } }),
    },
    orderBy: { createdAt: "desc" },
    take: opts.publicOnly ? 60 : 200,
    select: {
      id: true,
      contributorName: true,
      amountKes: true,
      method: true,
      status: true,
      mpesaCode: true,
      note: true,
      createdAt: true,
      confirmedAt: true,
    },
  });
}
