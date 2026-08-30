import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { getMediaForServe } from "@/lib/queries/media";
import { presumedLiving } from "@/lib/person";
import { toBytes } from "@/lib/bytes";

export const dynamic = "force-dynamic";

async function shareAllowsMedia(mediaId: string, treeId: string, slug: string): Promise<"thumb" | "full" | null> {
  const share = await db.sharedView.findUnique({
    where: { slug },
    select: { treeId: true, revoked: true, expiresAt: true, includeLiving: true },
  });
  if (!share || share.revoked || share.treeId !== treeId) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  const refs = await db.mediaRef.findMany({
    where: { mediaId },
    select: {
      person: {
        select: {
          living: true,
          privacy: true,
          eventRefs: {
            where: { event: { type: { in: ["Birth", "Death"] } } },
            select: { event: { select: { type: true, dateYear: true } } },
          },
        },
      },
    },
  });
  const people = refs.map((r) => r.person).filter(Boolean) as NonNullable<(typeof refs)[number]["person"]>[];
  if (people.length === 0) return null; // unattached media is not public
  for (const p of people) {
    if (p.privacy === "PRIVATE") return null;
    const birthYear = p.eventRefs.find((e) => e.event.type === "Birth")?.event.dateYear ?? null;
    const deathYear = p.eventRefs.find((e) => e.event.type === "Death")?.event.dateYear ?? null;
    const living = presumedLiving({
      explicitLiving: p.living,
      birthYear,
      deathYear,
      hasDeathEvent: deathYear != null,
    });
    if (living && !share.includeLiving) return null;
  }
  return "thumb"; // shares only ever serve downscaled previews
}

async function memorialAllowsMedia(mediaId: string, slug: string): Promise<boolean> {
  const m = await db.memorial.findUnique({
    where: { slug },
    select: { published: true, coverMediaId: true, personId: true },
  });
  if (!m || !m.published) return false;
  if (m.coverMediaId === mediaId) return true;
  const ref = await db.mediaRef.findFirst({
    where: { mediaId, personId: m.personId },
    select: { id: true },
  });
  return Boolean(ref);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const wantThumb = url.searchParams.get("v") === "thumb";
  const shareSlug = url.searchParams.get("s");
  const memorialSlug = url.searchParams.get("m");

  const media = await getMediaForServe(id);
  if (!media) return new NextResponse("Not found", { status: 404 });

  // ---- authorization ----
  let allowFull = false;
  const user = await getSessionUser();
  if (user) {
    const memberIds = new Set(media.tree.workspace.memberships.map((m) => m.userId));
    if (memberIds.has(user.id) || user.isPlatformAdmin) allowFull = true;
  }
  if (!allowFull) {
    let granted = false;
    if (shareSlug && (await shareAllowsMedia(id, media.treeId, shareSlug))) granted = true;
    if (!granted && memorialSlug && (await memorialAllowsMedia(id, memorialSlug))) granted = true;
    if (!granted) return new NextResponse("Forbidden", { status: 403 });
    // public grants serve the downscaled thumbnail only
  }

  const serveThumb = wantThumb || !allowFull;
  const body = serveThumb && media.thumbnail ? toBytes(media.thumbnail) : toBytes(media.bytes);
  const type = serveThumb && media.thumbnail ? (media.thumbMime ?? "image/webp") : media.mimeType;

  const etag = `"${createHash("sha1").update(body).digest("hex").slice(0, 24)}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const headers = new Headers({
    "Content-Type": type,
    "Content-Length": String(body.length),
    "Cache-Control": allowFull ? "private, max-age=86400" : "public, max-age=3600",
    ETag: etag,
  });

  // Basic range support (video / large files, authenticated only).
  const range = req.headers.get("range");
  if (range && allowFull && !serveThumb) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : body.length - 1;
      if (start <= end && end < body.length) {
        const chunk = body.subarray(start, end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: new Headers({
            "Content-Type": type,
            "Content-Range": `bytes ${start}-${end}/${body.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.length),
            "Cache-Control": "private, max-age=86400",
          }),
        });
      }
    }
  }

  return new NextResponse(body, { status: 200, headers });
}
