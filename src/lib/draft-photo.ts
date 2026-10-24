import "server-only";
import sharp from "sharp";

import { db } from "@/lib/db";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

/** Where a draft photo is served from, for previews in the browser. */
export const draftPhotoUrl = (id: string) => `/api/draft-photo/${id}`;

/**
 * Keep a photo a customer added while designing. It is re-encoded (so nothing hidden rides
 * along), turned upright and sized for print: 1600 px on the long side is over 300 dpi on an
 * A5 cover.
 */
export async function saveDraftPhoto(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_BYTES) throw new Error("That photo is too large. Keep it under 10 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta || !["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error("That file is not a photo we can use.");
  if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 300) throw new Error("That photo is too small. Use one at least 300 x 300 pixels.");
  const { data, info } = await sharp(input, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  const row = await db.draftPhoto.create({
    data: { bytes: new Uint8Array(data), width: info.width, height: info.height },
    select: { id: true },
  });
  return row.id;
}

/** The photo as a data: URL, for drawing it into a print file on the server. */
export async function draftPhotoDataUrl(id: string | undefined): Promise<string | undefined> {
  if (!id) return undefined;
  const row = await db.draftPhoto.findUnique({ where: { id }, select: { bytes: true, mimeType: true } });
  return row ? `data:${row.mimeType};base64,${Buffer.from(row.bytes).toString("base64")}` : undefined;
}
