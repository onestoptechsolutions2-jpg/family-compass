import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * A photo added while designing a piece. Anyone holding the id may see it: the id is only
 * in the private design link, and the photo goes on to a public memorial page anyway.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.draftPhoto.findUnique({ where: { id }, select: { bytes: true, mimeType: true } });
  if (!row) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(row.bytes), {
    headers: { "Content-Type": row.mimeType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
