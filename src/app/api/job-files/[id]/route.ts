import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canSeePartnerFiles } from "@/lib/partner-auth";

/** A photo a partner uploaded. Only an admin or that partner's own people can open it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.jobFile.findUnique({ where: { id }, include: { job: { select: { partnerId: true } } } });
  if (!file || !(await canSeePartnerFiles(file.job.partnerId))) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType.startsWith("image/") ? file.mimeType : "application/octet-stream",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
