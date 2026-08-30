import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { toBytes } from "@/lib/bytes";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });

  const job = await db.generationJob.findUnique({
    where: { id },
    select: {
      status: true,
      outputMediaId: true,
      tree: {
        select: { workspace: { select: { memberships: { select: { userId: true } } } } },
      },
    },
  });
  if (!job) return new NextResponse("Not found", { status: 404 });

  const isMember = job.tree.workspace.memberships.some((m) => m.userId === user.id);
  if (!isMember && !user.isPlatformAdmin) return new NextResponse("Forbidden", { status: 403 });

  if (job.status !== "OUTPUT_READY" || !job.outputMediaId) {
    return new NextResponse("This download is not ready or has not been unlocked", { status: 409 });
  }

  const media = await db.mediaObject.findUnique({
    where: { id: job.outputMediaId },
    select: { fileName: true, mimeType: true, bytes: true },
  });
  if (!media) return new NextResponse("File missing", { status: 404 });

  const body = toBytes(media.bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${media.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
