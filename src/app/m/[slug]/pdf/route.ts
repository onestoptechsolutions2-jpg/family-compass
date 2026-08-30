import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildMemorialBook } from "@/lib/generation/memorial-book";
import { toBytes } from "@/lib/bytes";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/** Full page-by-page memorial book for a published memorial, in its style. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await db.memorial.findUnique({
    where: { slug },
    select: { published: true, treeId: true, personId: true },
  });
  if (!m || !m.published) return new NextResponse("Not found", { status: 404 });

  const built = await buildMemorialBook(m.treeId, m.personId);
  if (!built) return new NextResponse("Not available", { status: 404 });

  return new NextResponse(toBytes(built.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(built.book.name) || "memorial"}.pdf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
