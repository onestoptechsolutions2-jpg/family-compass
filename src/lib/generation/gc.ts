import { db } from "@/lib/db";

/**
 * Delete generation artifacts past their server lifetime and null the pointers
 * on the job. A paid job whose output was purged just re-renders on the next
 * download attempt. Returns how many rows were removed.
 */
export async function purgeExpiredGeneratedFiles(): Promise<number> {
  const stale = await db.generatedFile.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, generationJobId: true, phase: true },
  });
  if (stale.length === 0) return 0;

  await db.generatedFile.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });

  const previewJobs = stale.filter((s) => s.phase === "preview").map((s) => s.generationJobId);
  const outputJobs = stale.filter((s) => s.phase === "output").map((s) => s.generationJobId);
  if (previewJobs.length) {
    await db.generationJob.updateMany({
      where: { id: { in: previewJobs } },
      data: { previewFileId: null },
    });
  }
  if (outputJobs.length) {
    await db.generationJob.updateMany({
      where: { id: { in: outputJobs } },
      data: { outputFileId: null },
    });
  }
  return stale.length;
}
