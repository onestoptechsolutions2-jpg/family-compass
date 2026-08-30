"use server";

import { revalidatePath } from "next/cache";
import { ImportKind } from "@prisma/client";

import { db } from "@/lib/db";
import { requireTreeManage } from "@/lib/rbac";
import { QUEUE, enqueue } from "@/lib/queue";

const MAX_BYTES = 25 * 1024 * 1024;

function detectKind(fileName: string): ImportKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ged") || lower.endsWith(".gedcom")) return ImportKind.GEDCOM;
  if (lower.endsWith(".gramps") || lower.endsWith(".xml") || lower.endsWith(".gpkg"))
    return ImportKind.GRAMPS_XML;
  return null;
}

export async function startImport(treeId: string, formData: FormData) {
  await requireTreeManage(treeId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to import");
  if (file.size > MAX_BYTES) throw new Error("File is larger than 25 MB");

  const kind = detectKind(file.name);
  if (!kind) throw new Error("Unsupported file — use a .gramps or .ged file");

  const bytes = Buffer.from(await file.arrayBuffer());

  const job = await db.importJob.create({
    data: { treeId, kind, fileName: file.name, fileBytes: bytes, status: "QUEUED" },
    select: { id: true },
  });

  await enqueue(
    kind === ImportKind.GEDCOM ? QUEUE.importGedcom : QUEUE.importGramps,
    { importJobId: job.id },
  );

  revalidatePath(`/trees/${treeId}/import`);
}
