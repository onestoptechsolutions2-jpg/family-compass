import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { toBytes } from "@/lib/bytes";

export const dynamic = "force-dynamic";

/** Serve the (watermarked / partial) preview artifact inline for members. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });

  const job = await db.generationJob.findUnique({
    where: { id },
    select: {
      previewFileId: true,
      tree: { select: { workspace: { select: { memberships: { select: { userId: true } } } } } },
    },
  });
  if (!job) return new NextResponse("Not found", { status: 404 });
  const isMember = job.tree.workspace.memberships.some((m) => m.userId === user.id);
  if (!isMember && !user.isPlatformAdmin) return new NextResponse("Forbidden", { status: 403 });

  const file = job.previewFileId
    ? await db.generatedFile.findUnique({
        where: { id: job.previewFileId },
        select: { mimeType: true, bytes: true },
      })
    : null;
  if (!file) return new NextResponse("Preview not available", { status: 404 });

  const body = toBytes(file.bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
