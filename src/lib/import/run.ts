import { db } from "@/lib/db";

export type ImportReport = {
  people: number;
  families: number;
  events: number;
  places: number;
  sources: number;
  notes: number;
  media: number;
  warnings: string[];
};

/**
 * Parse an uploaded Gramps XML / GEDCOM file (stored on ImportJob.fileBytes)
 * and materialise it into the tree.
 *
 * TODO(phase-2): implement the real parsers in src/lib/import/gramps.ts and
 * src/lib/import/gedcom.ts and map through src/lib/import/intermediate.ts.
 */
export async function runImport(
  importJobId: string,
  kind: "GRAMPS_XML" | "GEDCOM",
): Promise<ImportReport> {
  const job = await db.importJob.findUniqueOrThrow({ where: { id: importJobId } });
  void job;
  void kind;
  throw new Error("Import is not implemented yet (phase 2).");
}
