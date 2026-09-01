import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { toBytes } from "@/lib/bytes";
import { enqueue, QUEUE } from "@/lib/queue";

export const dynamic = "force-dynamic";

const UNLOCKED = new Set(["PAID", "RENDERING_OUTPUT", "OUTPUT_READY"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });

  const job = await db.generationJob.findUnique({
    where: { id },
    select: {
      status: true,
      outputFileId: true,
      tree: {
        select: { id: true, workspace: { select: { memberships: { select: { userId: true } } } } },
      },
    },
  });
  if (!job) return new NextResponse("Not found", { status: 404 });

  const isMember = job.tree.workspace.memberships.some((m) => m.userId === user.id);
  if (!isMember && !user.isPlatformAdmin) return new NextResponse("Forbidden", { status: 403 });

  if (!UNLOCKED.has(job.status)) {
    return new NextResponse("This download hasn't been unlocked yet", { status: 409 });
  }

  const file = job.outputFileId
    ? await db.generatedFile.findUnique({
        where: { id: job.outputFileId },
        select: { fileName: true, mimeType: true, bytes: true, expiresAt: true },
      })
    : null;

  const expired = file?.expiresAt && file.expiresAt.getTime() < Date.now();

  if (!file || expired) {
    // The job is paid but the clean file has lapsed (or a render is still
    // running) — regenerate for free and notify when it's ready.
    if (job.status !== "RENDERING_OUTPUT") {
      await db.generationJob.update({ where: { id }, data: { status: "RENDERING_OUTPUT" } });
      await enqueue(QUEUE.renderOutput, { generationJobId: id });
    }
    return new NextResponse(
      "This download had expired — we're regenerating it now and will notify you when it's ready.",
      { status: 202 },
    );
  }

  const body = toBytes(file.bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
