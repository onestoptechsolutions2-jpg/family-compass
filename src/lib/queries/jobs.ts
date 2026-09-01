import { db } from "@/lib/db";

export type QueueJob = {
  id: string;
  name: string;
  state: string;
  retryCount: number;
  retryLimit: number;
  createdOn: Date;
  startedOn: Date | null;
  error: string | null;
};

/** Non-terminal (and recently-failed) pg-boss jobs — what the worker still owes. */
export async function queueJobs(limit = 100): Promise<QueueJob[] | null> {
  try {
    const rows = await db.$queryRaw<
      {
        id: string;
        name: string;
        state: string;
        retrycount: number;
        retrylimit: number;
        createdon: Date;
        startedon: Date | null;
        output: unknown;
      }[]
    >`
      SELECT id, name, state, retrycount, retrylimit, createdon, startedon, output
      FROM pgboss.job
      WHERE state IN ('created', 'retry', 'active', 'failed')
      ORDER BY createdon DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      state: r.state,
      retryCount: r.retrycount,
      retryLimit: r.retrylimit,
      createdOn: r.createdon,
      startedOn: r.startedon,
      error:
        r.output && typeof r.output === "object"
          ? ((r.output as { message?: string; error?: string }).message ??
            (r.output as { error?: string }).error ??
            JSON.stringify(r.output).slice(0, 300))
          : null,
    }));
  } catch {
    return null; // worker never started — no pgboss schema
  }
}

/** GenerationJobs that aren't finished (or failed), oldest first. */
export async function pendingGenerations(limit = 100) {
  return db.generationJob.findMany({
    where: { status: { in: ["QUEUED", "RENDERING_PREVIEW", "RENDERING_OUTPUT", "PAID", "FAILED"] } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      error: true,
      createdAt: true,
      updatedAt: true,
      tree: { select: { id: true, name: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });
}

/** Import jobs still queued/running or failed. */
export async function pendingImports(limit = 50) {
  return db.importJob.findMany({
    where: { status: { in: ["QUEUED", "RUNNING", "FAILED"] } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      fileName: true,
      error: true,
      createdAt: true,
      updatedAt: true,
      tree: { select: { id: true, name: true } },
    },
  });
}
