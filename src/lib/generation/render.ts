import { GenerationKind } from "@prisma/client";

import { db } from "@/lib/db";
import { toBytes } from "@/lib/bytes";
import { getTreeGraph } from "@/lib/queries/graph";
import { loadTreeForExport } from "@/lib/export/load";
import { toGedcom } from "@/lib/export/gedcom";
import { toGrampsXml } from "@/lib/export/gramps";
import { chartSvg } from "@/lib/charts/svg";
import { svgToPng } from "@/lib/generation/raster";
import { chartPdf, familyBookPdf } from "@/lib/generation/pdf";
import { makeThumbnail } from "@/lib/media";
import { computeLayout } from "@/components/tree/layout";
import { computeFan } from "@/components/tree/fan";
import { getPaymentSettings, generationBaseKes } from "@/lib/payments";
import { computeGenerationPrice } from "@/lib/pricing";

type Artifact = { fileName: string; mime: string; bytes: Buffer };
type BuildResult = { artifact: Artifact; nodeCount: number; generations: number };

const CHART_KINDS = new Set<GenerationKind>([
  GenerationKind.PEDIGREE_PDF,
  GenerationKind.FAN_CHART,
  GenerationKind.DESCENDANT_CHART,
]);

async function saveMedia(treeId: string, a: Artifact): Promise<string> {
  const thumb = await makeThumbnail(a.bytes, a.mime);
  const row = await db.mediaObject.create({
    data: {
      treeId,
      fileName: a.fileName,
      mimeType: a.mime,
      byteSize: a.bytes.length,
      bytes: toBytes(a.bytes),
      thumbnail: thumb ? toBytes(thumb.data) : null,
      thumbMime: thumb?.mime ?? null,
      width: thumb?.width ?? null,
      height: thumb?.height ?? null,
      title: a.fileName,
    },
    select: { id: true },
  });
  return row.id;
}

async function buildArtifacts(
  generationJobId: string,
  phase: "preview" | "output",
): Promise<BuildResult> {
  const job = await db.generationJob.findUniqueOrThrow({
    where: { id: generationJobId },
    select: {
      kind: true,
      params: true,
      centralPersonId: true,
      tree: { select: { id: true, slug: true, name: true } },
    },
  });
  const watermark = phase === "preview";
  const params = (job.params ?? {}) as { generations?: number; title?: string };
  const gens = Math.min(6, Math.max(2, params.generations ?? 4));
  const base = job.tree.slug || "family-tree";

  if (CHART_KINDS.has(job.kind)) {
    if (!job.centralPersonId) throw new Error("This chart needs a central person");
    const graph = await getTreeGraph(job.tree.id, job.centralPersonId);
    if (!graph.persons[job.centralPersonId]) throw new Error("Central person not found in tree");
    const kind = job.kind as "PEDIGREE_PDF" | "FAN_CHART" | "DESCENDANT_CHART";

    const nodeCount =
      kind === "FAN_CHART"
        ? computeFan(graph, job.centralPersonId, Math.min(gens + 1, 7)).segments.length
        : computeLayout(
            graph,
            job.centralPersonId,
            kind === "PEDIGREE_PDF" ? "ancestors" : "descendants",
            gens,
          ).nodes.length;

    const { svg } = chartSvg(graph, job.centralPersonId, kind, gens, {
      watermark,
      title: params.title ?? job.tree.name,
    });
    const png = svgToPng(svg, 2400);
    const artifact: Artifact =
      phase === "preview"
        ? { fileName: `${base}-${kind.toLowerCase()}-preview.png`, mime: "image/png", bytes: png }
        : {
            fileName: `${base}-${kind.toLowerCase()}.pdf`,
            mime: "application/pdf",
            bytes: await chartPdf(png, { title: params.title ?? job.tree.name }),
          };
    return { artifact, nodeCount, generations: gens };
  }

  const data = await loadTreeForExport(job.tree.id);
  const nodeCount = data.people.length + data.families.length;

  if (job.kind === GenerationKind.FAMILY_BOOK) {
    const pdf = await familyBookPdf(data, { watermark });
    const suffix = phase === "preview" ? "-preview" : "";
    return {
      artifact: { fileName: `${base}-family-book${suffix}.pdf`, mime: "application/pdf", bytes: pdf },
      nodeCount,
      generations: gens,
    };
  }

  if (job.kind === GenerationKind.GEDCOM_EXPORT) {
    if (phase === "preview") {
      const preview =
        `Family Compass — GEDCOM export preview\n` +
        `${data.people.length} individuals, ${data.families.length} families.\n\n` +
        data.people
          .slice(0, 15)
          .map((p, i) => {
            const n = p.names.find((x) => x.preferred) ?? p.names[0];
            return `${i + 1}. ${[n?.first, n?.surname].filter(Boolean).join(" ")}`;
          })
          .join("\n") +
        `\n\nUnlock to download the full .ged file.\n`;
      return {
        artifact: { fileName: `${base}-gedcom-preview.txt`, mime: "text/plain", bytes: Buffer.from(preview) },
        nodeCount,
        generations: gens,
      };
    }
    return {
      artifact: {
        fileName: `${base}.ged`,
        mime: "text/vnd.familysearch.gedcom",
        bytes: Buffer.from(toGedcom(data)),
      },
      nodeCount,
      generations: gens,
    };
  }

  if (job.kind === GenerationKind.GRAMPS_EXPORT) {
    if (phase === "preview") {
      const preview =
        `Family Compass — Gramps export preview\n` +
        `${data.people.length} people, ${data.families.length} families, ${data.events.length} events.\n\n` +
        `Unlock to download the full .gramps file (gzipped Gramps XML 1.7.1).\n`;
      return {
        artifact: { fileName: `${base}-gramps-preview.txt`, mime: "text/plain", bytes: Buffer.from(preview) },
        nodeCount,
        generations: gens,
      };
    }
    return {
      artifact: { fileName: `${base}.gramps`, mime: "application/gzip", bytes: toGrampsXml(data) },
      nodeCount,
      generations: gens,
    };
  }

  throw new Error(`Unsupported generation kind: ${job.kind}`);
}

export async function renderGeneration(
  generationJobId: string,
  phase: "preview" | "output",
): Promise<void> {
  const job = await db.generationJob.findUniqueOrThrow({
    where: { id: generationJobId },
    select: { treeId: true, kind: true },
  });

  const { artifact, nodeCount, generations } = await buildArtifacts(generationJobId, phase);
  const mediaId = await saveMedia(job.treeId, artifact);

  if (phase === "preview") {
    const settings = await getPaymentSettings();
    const bases = await generationBaseKes();
    const baseKes = bases[job.kind] ?? settings.defaultPriceKes;
    const { priceKes } = computeGenerationPrice(baseKes, generations, nodeCount, settings);
    await db.generationJob.update({
      where: { id: generationJobId },
      data: {
        previewMediaId: mediaId,
        status: "PREVIEW_READY",
        error: null,
        nodeCount,
        priceKes,
      },
    });
  } else {
    await db.generationJob.update({
      where: { id: generationJobId },
      data: { outputMediaId: mediaId, status: "OUTPUT_READY", error: null },
    });
  }
}
