import { db } from "@/lib/db";
import { getMemorialBookData } from "@/lib/queries/memorial";
import { memorialBookPdf } from "@/lib/generation/pdf";

const PHOTO_CAP = 10;
const BYTE_BUDGET = 8 * 1024 * 1024; // keep the PDF well under the media limit

/**
 * Assemble the full page-by-page memorial book for a person: biography,
 * family, milestones, roots, photographs, order of service and guestbook
 * tributes, rendered in the memorial's chosen style. Returns null if the
 * person has no memorial yet.
 */
export async function buildMemorialBook(
  treeId: string,
  personId: string,
  opts: { watermark?: boolean } = {},
): Promise<{ pdf: Buffer; book: NonNullable<Awaited<ReturnType<typeof getMemorialBookData>>> } | null> {
  const book = await getMemorialBookData(treeId, personId);
  if (!book) return null;

  const wantIds = [
    ...(book.coverMediaId ? [book.coverMediaId] : []),
    ...book.photos.slice(0, PHOTO_CAP).map((p) => p.id),
  ];
  const media = wantIds.length
    ? await db.mediaObject.findMany({
        where: { id: { in: wantIds } },
        select: { id: true, bytes: true, mimeType: true },
      })
    : [];
  const byId = new Map(media.map((m) => [m.id, m]));

  const cover = book.coverMediaId
    ? (() => {
        const c = byId.get(book.coverMediaId);
        return c ? { bytes: Buffer.from(c.bytes), mime: c.mimeType } : null;
      })()
    : null;

  let used = cover?.bytes.length ?? 0;
  const photos: { bytes: Buffer; mime: string; caption?: string | null }[] = [];
  for (const p of book.photos.slice(0, PHOTO_CAP)) {
    const m = byId.get(p.id);
    if (!m) continue;
    if (used + m.bytes.length > BYTE_BUDGET) break;
    used += m.bytes.length;
    photos.push({ bytes: Buffer.from(m.bytes), mime: m.mimeType, caption: p.caption });
  }

  const pdf = await memorialBookPdf(
    {
      name: book.name,
      headline: book.headline,
      born: book.born,
      died: book.died,
      bornPlace: book.bornPlace,
      diedPlace: book.diedPlace,
      restingPlace: book.restingPlace,
      eulogy: book.eulogy,
      serviceText: book.serviceText,
      clan: book.clan,
      subClan: book.subClan,
      community: book.community,
      clanOrigin: book.clanOrigin,
      parents: book.parents,
      spouses: book.spouses,
      children: book.children,
      survivors: book.survivors,
      preceded: book.preceded,
      timeline: book.timeline,
      program: book.program,
      guestbook: book.guestbook,
      cover,
      photos,
    },
    { watermark: opts.watermark, template: book.template },
  );

  return { pdf, book };
}
