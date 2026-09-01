import { db } from "@/lib/db";

/**
 * Generated charts / PDFs are stored in GeneratedFile now, but legacy jobs
 * left their output as a MediaObject linked via GenerationJob. Those are not
 * user uploads — keep them out of the gallery and the storage quota.
 */
const NOT_A_GENERATED_ARTIFACT = {
  previewOfJobs: { none: {} },
  outputOfJobs: { none: {} },
} as const;

export async function treeMediaUsage(treeId: string): Promise<number> {
  const agg = await db.mediaObject.aggregate({
    where: { treeId, ...NOT_A_GENERATED_ARTIFACT },
    _sum: { byteSize: true },
  });
  return agg._sum.byteSize ?? 0;
}

export async function listMedia(treeId: string) {
  return db.mediaObject.findMany({
    where: { treeId, ...NOT_A_GENERATED_ARTIFACT },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      width: true,
      height: true,
      title: true,
      createdAt: true,
      _count: { select: { refs: true } },
    },
    take: 500,
  });
}

/** Media attached to a person, with the ref id for detaching. */
export async function personMedia(treeId: string, personId: string) {
  const refs = await db.mediaRef.findMany({
    where: { personId, media: { treeId } },
    orderBy: { order: "asc" },
    select: {
      id: true,
      caption: true,
      media: { select: { id: true, fileName: true, mimeType: true } },
    },
  });
  return refs;
}

export async function getMediaForServe(mediaId: string) {
  return db.mediaObject.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      treeId: true,
      mimeType: true,
      thumbMime: true,
      byteSize: true,
      bytes: true,
      thumbnail: true,
      createdAt: true,
      tree: {
        select: {
          workspace: { select: { memberships: { select: { userId: true } } } },
        },
      },
    },
  });
}
