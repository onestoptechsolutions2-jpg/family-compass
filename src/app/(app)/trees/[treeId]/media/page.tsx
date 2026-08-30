import { loadTreeContext, canEdit } from "@/lib/rbac";
import { listMedia, treeMediaUsage } from "@/lib/queries/media";
import { TREE_QUOTA_BYTES, humanBytes } from "@/lib/media";
import { MediaThumb } from "@/components/media/MediaThumb";
import { UploadForm } from "@/components/media/UploadForm";
import { uploadMedia, deleteMedia } from "./actions";

export const metadata = { title: "Media" };

export default async function MediaPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const [items, usage] = await Promise.all([listMedia(treeId), treeMediaUsage(treeId)]);
  const pct = Math.min(100, Math.round((usage / TREE_QUOTA_BYTES) * 100));

  return (
    <div className="flex flex-col gap-5">
      {editable && <UploadForm action={uploadMedia.bind(null, treeId)} withOccasion />}

      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
        <div className="h-2 w-40 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-brand-600)" }} />
        </div>
        {humanBytes(usage)} of {humanBytes(TREE_QUOTA_BYTES)} · {items.length} files
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No media yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((m) => (
            <figure
              key={m.id}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <a
                href={`/api/media/${m.id}`}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square"
              >
                <MediaThumb mediaId={m.id} mimeType={m.mimeType} alt={m.title ?? m.fileName} />
              </a>
              <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                <span className="truncate" title={m.title ?? m.fileName}>
                  {m.title ?? m.fileName}
                </span>
                {editable && (
                  <form action={deleteMedia.bind(null, treeId, m.id)}>
                    <button className="text-red-600 hover:underline" title="Delete">
                      ✕
                    </button>
                  </form>
                )}
              </figcaption>
              {m._count.refs > 0 && (
                <div className="px-2 pb-1.5 text-[10px]" style={{ color: "var(--muted)" }}>
                  linked to {m._count.refs} record{m._count.refs === 1 ? "" : "s"}
                </div>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
