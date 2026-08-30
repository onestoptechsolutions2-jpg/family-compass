import sharp from "sharp";

import { slugify, randomToken } from "@/lib/slug";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const TREE_QUOTA_BYTES = 250 * 1024 * 1024; // 250 MB per tree

/** File extension from the original name, falling back to the mime type. */
export function fileExt(originalName: string, mime: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(originalName.trim());
  if (m?.[1]) return m[1].toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("avif")) return "avif";
  if (mime.includes("tiff")) return "tif";
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "jpg";
  return "bin";
}

/**
 * Build a stable, human-readable, unique file name + title for an upload:
 *   "<owner>-<occasion>-<NN>-<token>.<ext>"  /  "Owner Name · Occasion · N"
 * The random token guarantees uniqueness; NN is the per-owner sequence.
 */
export function buildMediaName(opts: {
  owner: string;
  occasion?: string | null;
  seq: number;
  ext: string;
}): { fileName: string; title: string } {
  const owner = (opts.owner || "photo").trim();
  const occasion = (opts.occasion ?? "").trim();
  const slug =
    [owner, occasion || "photo"].map((s) => slugify(s)).filter(Boolean).join("-") || "photo";
  const nn = String(Math.max(1, opts.seq)).padStart(2, "0");
  return {
    fileName: `${slug}-${nn}-${randomToken(5)}.${opts.ext}`,
    title: `${owner}${occasion ? ` · ${occasion}` : ""} · ${Math.max(1, opts.seq)}`,
  };
}

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
  "application/pdf",
  "text/plain",
];

export function isAllowedType(mime: string): boolean {
  return ALLOWED.includes(mime) || mime.startsWith("image/");
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export type ThumbResult = {
  data: Buffer;
  mime: string;
  width: number | null;
  height: number | null;
};

/** Downscaled WebP preview for images; null for other types. */
export async function makeThumbnail(buf: Buffer, mime: string): Promise<ThumbResult | null> {
  if (!isImage(mime)) return null;
  try {
    const img = sharp(buf, { failOn: "none", animated: false });
    const meta = await img.metadata();
    const data = await img
      .rotate()
      .resize(500, 500, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return {
      data,
      mime: "image/webp",
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  } catch {
    return null;
  }
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
