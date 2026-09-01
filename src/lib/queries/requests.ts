import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { GENERATION_LABELS } from "@/lib/pricing";

export type RequestRow = {
  id: string;
  type: "generation" | "deep-search" | "research";
  label: string;
  by: string;
  status: string;
  statusLabel: string;
  createdAt: Date;
  href: string | null;
  receiptRef: string | null;
};

const GEN_STATUS: Record<string, string> = {
  QUEUED: "Queued",
  RENDERING_PREVIEW: "Rendering preview",
  PREVIEW_READY: "Preview ready — unlock to get the clean copy",
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Paid — preparing the clean file",
  RENDERING_OUTPUT: "Preparing the clean file",
  OUTPUT_READY: "Ready to download",
  FAILED: "Failed",
};

/** Everything requested on a tree — for the family admin / managers. */
export async function treeRequests(treeId: string): Promise<RequestRow[]> {
  const jobs = await db.generationJob.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      requestedBy: { select: { name: true, email: true } },
      centralPerson: { select: { names: { select: NAME_SELECT } } },
      payment: { select: { reference: true, status: true } },
    },
  });

  return jobs.map((j) => ({
    id: j.id,
    type: "generation" as const,
    label:
      `${GENERATION_LABELS[j.kind]}` +
      (j.centralPerson ? ` — centred on ${displayName(j.centralPerson.names)}` : ""),
    by: j.requestedBy.name ?? j.requestedBy.email,
    status: j.status,
    statusLabel: GEN_STATUS[j.status] ?? j.status,
    createdAt: j.createdAt,
    href: `/trees/${treeId}/charts`,
    receiptRef: j.payment?.status === "PAID" ? j.payment.reference : null,
  }));
}

/** Everything the signed-in user has requested, across trees and services. */
export async function myRequests(userId: string): Promise<RequestRow[]> {
  const [jobs, deep, research] = await Promise.all([
    db.generationJob.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        kind: true,
        status: true,
        createdAt: true,
        tree: { select: { id: true, name: true } },
        payment: { select: { reference: true, status: true } },
      },
    }),
    db.deepSearch.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, resultCount: true, createdAt: true, payment: { select: { reference: true, status: true } } },
    }),
    db.researchEngagement.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, subjectName: true, status: true, createdAt: true, quotedKes: true, payment: { select: { reference: true, status: true } } },
    }),
  ]);

  const rows: RequestRow[] = [];

  for (const j of jobs) {
    rows.push({
      id: j.id,
      type: "generation",
      label: `${GENERATION_LABELS[j.kind]} · ${j.tree.name}`,
      by: "you",
      status: j.status,
      statusLabel: GEN_STATUS[j.status] ?? j.status,
      createdAt: j.createdAt,
      href: `/trees/${j.tree.id}/charts`,
      receiptRef: j.payment?.status === "PAID" ? j.payment.reference : null,
    });
  }
  for (const d of deep) {
    rows.push({
      id: d.id,
      type: "deep-search",
      label: `Deep search · ${d.resultCount} match${d.resultCount === 1 ? "" : "es"}`,
      by: "you",
      status: d.status,
      statusLabel: d.status === "PAID" ? "Unlocked" : "Preview",
      createdAt: d.createdAt,
      href: "/discover",
      receiptRef: d.payment?.status === "PAID" ? d.payment.reference : null,
    });
  }
  for (const e of research) {
    rows.push({
      id: e.id,
      type: "research",
      label: `Research engagement · ${e.subjectName}`,
      by: "you",
      status: e.status,
      statusLabel: e.status.toLowerCase().replace(/_/g, " "),
      createdAt: e.createdAt,
      href: "/research",
      receiptRef: e.payment?.status === "PAID" ? e.payment.reference : null,
    });
  }

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
