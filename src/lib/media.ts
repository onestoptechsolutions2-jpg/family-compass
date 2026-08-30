import sharp from "sharp";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const TREE_QUOTA_BYTES = 250 * 1024 * 1024; // 250 MB per tree

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
