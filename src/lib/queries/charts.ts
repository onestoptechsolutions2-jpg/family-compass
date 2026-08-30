import { db } from "@/lib/db";

export async function getChartsData(treeId: string, workspaceId: string) {
  const [workspace, jobs, payments] = await Promise.all([
    db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { exportCredits: true },
    }),
    db.generationJob.findMany({
      where: { treeId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        status: true,
        params: true,
        error: true,
        previewMediaId: true,
        outputMediaId: true,
        freeUnlock: true,
        createdAt: true,
        centralPerson: {
          select: {
            names: {
              select: {
                first: true,
                surname: true,
                surnamePrefix: true,
                suffix: true,
                nick: true,
                title: true,
                preferred: true,
                type: true,
                order: true,
              },
            },
          },
        },
      },
    }),
    db.payment.findMany({
      where: { workspaceId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        kind: true,
        creditsGranted: true,
        amountKes: true,
        currency: true,
        reference: true,
        mpesaCode: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
      },
    }),
  ]);

  return { credits: workspace.exportCredits, jobs, payments };
}
