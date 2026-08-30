import { isImage } from "@/lib/media";

export function MediaThumb({
  mediaId,
  mimeType,
  alt,
  share,
  className,
}: {
  mediaId: string;
  mimeType: string;
  alt: string;
  share?: string;
  className?: string;
}) {
  if (isImage(mimeType)) {
    const src = `/api/media/${mediaId}?v=thumb${share ? `&s=${share}` : ""}`;
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={className ?? "h-full w-full object-cover"}
      />
    );
  }
  const label = mimeType === "application/pdf" ? "PDF" : mimeType.split("/")[1]?.toUpperCase() || "FILE";
  return (
    <div
      className={`grid h-full w-full place-items-center text-xs font-semibold ${className ?? ""}`}
      style={{ background: "var(--bg)", color: "var(--muted)" }}
    >
      {label}
    </div>
  );
}
