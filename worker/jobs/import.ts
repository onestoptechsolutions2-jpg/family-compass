import type { Job } from "pg-boss";

import { db } from "@/lib/db";
import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { runImport } from "@/lib/import/run";

type ImportPayload =
  | JobPayloads[typeof QUEUE.importGramps]
  | JobPayloads[typeof QUEUE.importGedcom];

async function processImport(job: Job<ImportPayload>, kind: "GRAMPS_XML" | "GEDCOM") {
  const { importJobId } = job.data;
  try {
    await db.importJob.update({
      where: { id: importJobId },
      data: { status: "RUNNING" },
    });
    const report = await runImport(importJobId, kind);
    await db.importJob.update({
      where: { id: importJobId },
      data: { status: "COMPLETED", report, error: null },
    });
    console.log(`[import] ${kind} ${importJobId} completed`, report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[import] ${kind} ${importJobId} failed`, err);
    await db.importJob.update({
      where: { id: importJobId },
      data: { status: "FAILED", error: message },
    });
  }
}

export async function handleImportGramps(jobs: Job<ImportPayload>[]) {
  for (const job of jobs) await processImport(job, "GRAMPS_XML");
}

export async function handleImportGedcom(jobs: Job<ImportPayload>[]) {
  for (const job of jobs) await processImport(job, "GEDCOM");
}
