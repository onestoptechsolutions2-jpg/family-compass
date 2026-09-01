import { db } from "@/lib/db";
import { enqueue, QUEUE } from "@/lib/queue";
import { spendCredits } from "@/lib/credits";
import { getPaymentSettings } from "@/lib/payments";
import { creditsForPrice } from "@/lib/pricing";

/**
 * A payment just cleared for this workspace (credit bundle or Family plan).
 * Push every generation that was parked at AWAITING_PAYMENT straight through
 * to the clean render — so the buyer doesn't have to come back and click
 * "unlock" a second time. Best-effort; never throws.
 */
export async function resumeAwaitingGenerations(
  workspaceId: string,
  actorId?: string | null,
): Promise<void> {
  try {
    const jobs = await db.generationJob.findMany({
      where: { status: "AWAITING_PAYMENT", tree: { workspaceId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        priceKes: true,
        tree: { select: { keeperUntil: true } },
      },
    });
    if (jobs.length === 0) return;

    const settings = await getPaymentSettings();

    for (const job of jobs) {
      const planActive =
        job.tree.keeperUntil != null && job.tree.keeperUntil.getTime() > Date.now();

      if (!planActive) {
        const needed = creditsForPrice(
          job.priceKes || settings.defaultPriceKes,
          settings.defaultPriceKes,
        );
        const spent = await spendCredits(workspaceId, job.id, needed, actorId ?? undefined);
        if (!spent) break; // out of credits — leave the rest parked
      }

      await db.generationJob.update({
        where: { id: job.id },
        data: { status: "PAID", unlockedAt: new Date() },
      });
      await enqueue(QUEUE.renderOutput, { generationJobId: job.id });
    }
  } catch (err) {
    console.error("[generation] resumeAwaitingGenerations failed", err);
  }
}
