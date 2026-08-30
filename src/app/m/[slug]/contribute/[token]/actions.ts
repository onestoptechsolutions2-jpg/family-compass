"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { notifyTreeManagers } from "@/lib/notify";
import { emitTreeEvent } from "@/lib/webhooks";
import { CONTRIBUTION_SECTIONS } from "@/lib/memorial-sections";
import { treeMediaUsage } from "@/lib/queries/media";
import { toBytes } from "@/lib/bytes";
import {
  MAX_FILE_BYTES,
  TREE_QUOTA_BYTES,
  isAllowedType,
  makeThumbnail,
  fileExt,
  buildMediaName,
} from "@/lib/media";

const SECTION_VALUES = new Set<string>(CONTRIBUTION_SECTIONS.map((s) => s.value));

/** Contributors can attach at most this many photos to a single contribution. */
const MAX_CONTRIB_PHOTOS = 10;

/** Resolve a token to a memorial, whether it's a per-person invite or the
 *  shareable group link. Returns the contributor id when it's a personal one. */
async function resolveToken(slug: string, token: string) {
  const contributor = await db.memorialContributor.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      memorialId: true,
      memorial: { select: { slug: true, treeId: true, personId: true } },
    },
  });
  if (contributor && contributor.memorial.slug === slug) {
    return {
      memorialId: contributor.memorialId,
      contributorId: contributor.id as string | null,
      defaultName: contributor.name,
      treeId: contributor.memorial.treeId,
      personId: contributor.memorial.personId,
    };
  }
  const m = await db.memorial.findFirst({
    where: { groupContribToken: token, slug },
    select: { id: true, treeId: true, personId: true },
  });
  if (m) {
    return { memorialId: m.id, contributorId: null, defaultName: "", treeId: m.treeId, personId: m.personId };
  }
  return null;
}

/** Store contributor-supplied photos as tree media (unattached — a manager
 *  attaches them to the person when the contribution is accepted). */
async function storeContributionPhotos(
  treeId: string,
  authorName: string,
  files: File[],
): Promise<{ ids: string[]; error?: string }> {
  if (files.length === 0) return { ids: [] };
  if (files.length > MAX_CONTRIB_PHOTOS) {
    return { ids: [], error: `photos-max` };
  }

  let usage = await treeMediaUsage(treeId);
  let seq = await db.mediaObject.count({ where: { treeId } });
  const ids: string[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) return { ids, error: "photo-size" };
    if (!isAllowedType(file.type)) return { ids, error: "photo-type" };
    if (usage + file.size > TREE_QUOTA_BYTES) return { ids, error: "photo-quota" };

    const buf = Buffer.from(await file.arrayBuffer());
    const thumb = await makeThumbnail(buf, file.type);
    seq += 1;
    const named = buildMediaName({
      owner: authorName || "contribution",
      occasion: "contribution",
      seq,
      ext: fileExt(file.name, file.type),
    });

    const media = await db.mediaObject.create({
      data: {
        treeId,
        fileName: named.fileName,
        title: named.title,
        mimeType: file.type || "application/octet-stream",
        byteSize: buf.length,
        bytes: toBytes(buf),
        thumbnail: thumb ? toBytes(thumb.data) : null,
        thumbMime: thumb?.mime ?? null,
        width: thumb?.width ?? null,
        height: thumb?.height ?? null,
      },
      select: { id: true },
    });
    ids.push(media.id);
    usage += buf.length;
  }
  return { ids };
}

export async function submitContribution(slug: string, token: string, formData: FormData) {
  const ctx = await resolveToken(slug, token);
  if (!ctx) redirect(`/m/${slug}`);

  const back = (err: string) => redirect(`/m/${slug}/contribute/${token}?err=${err}`);

  const authorName =
    String(formData.get("authorName") ?? "").trim().slice(0, 120) || ctx.defaultName;
  if (authorName.length < 2) back("name");

  const rawSection = String(formData.get("section") ?? "memory");
  const section = SECTION_VALUES.has(rawSection) ? rawSection : "other";

  // Optional structured date corrections — folded into the body so a manager
  // sees exactly what to change.
  const bornDate = String(formData.get("bornDate") ?? "").trim().slice(0, 60);
  const diedDate = String(formData.get("diedDate") ?? "").trim().slice(0, 60);
  const otherDate = String(formData.get("otherDate") ?? "").trim().slice(0, 120);

  let body = String(formData.get("body") ?? "").trim().slice(0, 8000);
  const dateLines = [
    bornDate && `Born: ${bornDate}`,
    diedDate && `Died: ${diedDate}`,
    otherDate && `Other date: ${otherDate}`,
  ].filter(Boolean);
  if (dateLines.length > 0) {
    body = `Proposed dates —\n${dateLines.join("\n")}${body ? `\n\n${body}` : ""}`;
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (body.length < 3 && files.length === 0) back("1");

  const stored = await storeContributionPhotos(ctx.treeId, authorName, files);
  if (stored.error) {
    // best-effort cleanup of anything already written before the failure
    if (stored.ids.length > 0) {
      await db.mediaObject.deleteMany({ where: { id: { in: stored.ids } } });
    }
    back(stored.error);
  }

  await db.memorialContribution.create({
    data: {
      memorialId: ctx.memorialId,
      contributorId: ctx.contributorId,
      authorName,
      section,
      body: body || "(photos only)",
      photoMediaIds: stored.ids,
    },
  });

  await notifyTreeManagers(ctx.treeId, {
    kind: "memorial.contribution",
    title: "New memorial contribution",
    body:
      `${authorName}: "${(body || "(photos only)").slice(0, 140)}"` +
      (stored.ids.length ? ` · ${stored.ids.length} photo(s)` : ""),
    linkPath: `/trees/${ctx.treeId}/people/${ctx.personId}/memorial`,
  });

  await emitTreeEvent(ctx.treeId, "memorial.contribution_received", {
    slug,
    personId: ctx.personId,
    section,
    authorName,
    photos: stored.ids.length,
    hasDateProposal: dateLines.length > 0,
  });

  revalidatePath(`/m/${slug}/contribute/${token}`);
  redirect(`/m/${slug}/contribute/${token}?sent=1`);
}
