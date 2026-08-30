import type { Job } from "pg-boss";

import { db } from "@/lib/db";
import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { renderGeneration } from "@/lib/generation/render";

type PreviewPayload = JobPayloads[typeof QUEUE.renderPreview];
type OutputPayload = JobPayloads[typeof QUEUE.renderOutput];

async function run(generationJobId: string, phase: "preview" | "output") {
  try {
    await db.generationJob.update({
      where: { id: generationJobId },
      data: { status: phase === "preview" ? "RENDERING_PREVIEW" : "RENDERING_OUTPUT" },
    });
    await renderGeneration(generationJobId, phase);
    console.log(`[generation] ${generationJobId} ${phase} done`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generation] ${generationJobId} ${phase} failed`, err);
    await db.generationJob.update({
      where: { id: generationJobId },
      data: { status: "FAILED", error: message },
    });
  }
}

export async function handleRenderPreview(jobs: Job<PreviewPayload>[]) {
  for (const job of jobs) await run(job.data.generationJobId, "preview");
}

export async function handleRenderOutput(jobs: Job<OutputPayload>[]) {
  for (const job of jobs) await run(job.data.generationJobId, "output");
}
