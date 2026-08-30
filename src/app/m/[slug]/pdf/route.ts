import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getMemorialBookData } from "@/lib/queries/memorial";
import { memorialBookPdf } from "@/lib/generation/pdf";
import { toBytes } from "@/lib/bytes";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/** Free one-page-per-section memorial PDF for a published memorial. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await db.memorial.findUnique({
    where: { slug },
    select: { published: true, treeId: true, personId: true },
  });
  if (!m || !m.published) return new NextResponse("Not found", { status: 404 });

  const book = await getMemorialBookData(m.treeId, m.personId);
  if (!book) return new NextResponse("Not available", { status: 404 });

  let cover: { bytes: Buffer; mime: string } | null = null;
  if (book.coverMediaId) {
    const c = await db.mediaObject.findUnique({
      where: { id: book.coverMediaId },
      select: { bytes: true, mimeType: true },
    });
    if (c) cover = { bytes: Buffer.from(c.bytes), mime: c.mimeType };
  }

  const pdf = await memorialBookPdf({
    name: book.name,
    headline: book.headline,
    born: book.born,
    died: book.died,
    restingPlace: book.restingPlace,
    eulogy: book.eulogy,
    serviceText: book.serviceText,
    survivors: book.survivors,
    preceded: book.preceded,
    program: book.program,
    cover,
  });

  return new NextResponse(toBytes(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(book.name) || "memorial"}.pdf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
