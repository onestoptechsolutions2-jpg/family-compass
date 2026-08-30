import { db } from "@/lib/db";

/**
 * Render a GenerationJob.
 *  - phase "preview": watermarked, screen-resolution, free.
 *  - phase "output":  clean, high-resolution, unlocked after payment.
 *
 * TODO(phase-6): implement chart layout (src/lib/charts/*), SVG→PNG via
 * @resvg/resvg-js, PDF + family book via @react-pdf/renderer, and GEDCOM /
 * .gramps serialisers. Store results as MediaObject rows and link them back
 * onto the GenerationJob.
 */
export async function renderGeneration(
  generationJobId: string,
  phase: "preview" | "output",
): Promise<void> {
  const job = await db.generationJob.findUniqueOrThrow({ where: { id: generationJobId } });
  void job;
  void phase;
  throw new Error("Generation rendering is not implemented yet (phase 6).");
}
