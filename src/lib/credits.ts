import { CreditReason, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

/** Add credits to a workspace and record the ledger entry. */
export async function grantCredits(
  workspaceId: string,
  amount: number,
  opts: {
    reason: CreditReason;
    paymentId?: string;
    generationJobId?: string;
    actorId?: string;
    note?: string;
  },
  client: Tx | typeof db = db,
): Promise<number> {
  const ws = await client.workspace.update({
    where: { id: workspaceId },
    data: { exportCredits: { increment: amount } },
    select: { exportCredits: true },
  });
  await client.creditLedger.create({
    data: {
      workspaceId,
      delta: amount,
      balanceAfter: ws.exportCredits,
      reason: opts.reason,
      paymentId: opts.paymentId,
      generationJobId: opts.generationJobId,
      actorId: opts.actorId,
      note: opts.note,
    },
  });
  return ws.exportCredits;
}

/**
 * Spend `count` credits for a generation job. Returns true if consumed, false
 * if the workspace didn't have enough.
 */
export async function spendCredits(
  workspaceId: string,
  generationJobId: string,
  count: number,
  actorId?: string,
): Promise<boolean> {
  const n = Math.max(1, Math.ceil(count));
  return db.$transaction(async (tx) => {
    const ws = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { exportCredits: true },
    });
    if (ws.exportCredits < n) return false;
    const updated = await tx.workspace.update({
      where: { id: workspaceId },
      data: { exportCredits: { decrement: n } },
      select: { exportCredits: true },
    });
    await tx.creditLedger.create({
      data: {
        workspaceId,
        delta: -n,
        balanceAfter: updated.exportCredits,
        reason: CreditReason.SPEND,
        generationJobId,
        actorId,
      },
    });
    return true;
  });
}

export const spendCredit = (workspaceId: string, generationJobId: string, actorId?: string) =>
  spendCredits(workspaceId, generationJobId, 1, actorId);
