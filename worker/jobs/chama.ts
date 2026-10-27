import type { Job } from "pg-boss";

import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { linkFundToChama, refreshFromChama } from "@/lib/chama-partner-funds";

/** Open a family's fund on Chama. Chama being down is retried; anything else is final. */
export async function handleChamaLink(jobs: Job<JobPayloads[typeof QUEUE.chamaLink]>[]) {
  for (const job of jobs) {
    const { fundId, chair, family } = job.data;
    const r = await linkFundToChama(fundId, chair, family);
    if (!r.linked && r.retry) throw new Error(`[chama] fund ${fundId} not linked yet: ${r.reason}`);
    console.log(`[chama] fund ${fundId}:`, r.linked ? "linked" : r.reason);
  }
}

/** Fetch a fund's totals from Chama when its webhook has not kept them fresh. */
export async function handleChamaRefresh(jobs: Job<JobPayloads[typeof QUEUE.chamaRefresh]>[]) {
  for (const job of jobs) await refreshFromChama(job.data.fundId);
}
