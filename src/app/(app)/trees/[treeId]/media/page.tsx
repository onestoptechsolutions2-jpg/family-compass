import { loadTreeContext, canEdit } from "@/lib/rbac";
import { listMedia, treeMediaUsage } from "@/lib/queries/media";
import { mediaGallery, type GalleryGroup, type GalleryItem } from "@/lib/queries/media-gallery";
import { TREE_QUOTA_BYTES, humanBytes } from "@/lib/media";
import { MediaThumb } from "@/components/media/MediaThumb";
import { UploadForm } from "@/components/media/UploadForm";
import { Tabs, type TabItem } from "@/components/Tabs";
import { uploadMedia, deleteMedia } from "./actions";

export const metadata = { title: "Media" };

function Thumb({ item }: { item: GalleryItem }) {
  return (
    <figure
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <a href={`/api/media/${item.id}`} target="_blank" rel="noreferrer" className="block aspect-square">
        <MediaThumb mediaId={item.id} mimeType={item.mimeType} alt={item.caption ?? item.title ?? item.fileName} />
      </a>
      <figcaption className="truncate px-2 py-1.5 text-xs" title={item.caption ?? item.title ?? item.fileName}>
        {item.caption ?? item.title ?? item.fileName}
      </figcaption>
    </figure>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{children}</div>
  );
}

function GroupedGallery({ groups, empty }: { groups: GalleryGroup[]; empty: string }) {
  if (groups.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted)" }}>{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            {g.href ? (
              <a href={g.href} className="font-medium hover:underline" style={{ color: "var(--link)" }}>
                {g.label}
              </a>
            ) : (
              <h3 className="font-medium">{g.label}</h3>
            )}
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {g.sublabel ? `${g.sublabel} · ` : ""}
              {g.items.length} photo{g.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <Grid>
            {g.items.map((it) => (
              <Thumb key={`${g.key}-${it.id}`} item={it} />
            ))}
          </Grid>
        </section>
      ))}
    </div>
  );
}

export default async function MediaPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const [items, usage, gallery] = await Promise.all([
    listMedia(treeId),
    treeMediaUsage(treeId),
    mediaGallery(treeId),
  ]);
  const pct = Math.min(100, Math.round((usage / TREE_QUOTA_BYTES) * 100));

  const allFiles = (
    <>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No media yet.
        </p>
      ) : (
        <Grid>
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
        </Grid>
      )}
    </>
  );

  const tabs: TabItem[] = [
    { id: "all", label: "All files", badge: items.length || undefined, panel: allFiles },
    {
      id: "events",
      label: "By event",
      badge: gallery.byEvent.length || undefined,
      panel: (
        <GroupedGallery
          groups={gallery.byEvent}
          empty="No photos are attached to an event yet. Open an event and add media, or attach a photo from a person's timeline."
        />
      ),
    },
    {
      id: "people",
      label: "By person",
      badge: gallery.byPerson.length || undefined,
      panel: (
        <GroupedGallery groups={gallery.byPerson} empty="No photos are attached to a person yet." />
      ),
    },
    {
      id: "places",
      label: "By place",
      badge: gallery.byPlace.length || undefined,
      panel: <GroupedGallery groups={gallery.byPlace} empty="No photos are attached to a place yet." />,
    },
    {
      id: "occasions",
      label: "By occasion",
      badge: gallery.byOccasion.length || undefined,
      panel: (
        <GroupedGallery
          groups={gallery.byOccasion}
          empty="No occasions yet. Add an occasion when you upload, or a caption when you attach a photo."
        />
      ),
    },
  ];

  if (gallery.unfiled.length > 0) {
    tabs.push({
      id: "unfiled",
      label: "Unfiled",
      badge: gallery.unfiled.length,
      panel: (
        <div className="flex flex-col gap-2">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Not linked to anyone or anything yet — open a person, event or place and attach these.
          </p>
          <Grid>
            {gallery.unfiled.map((it) => (
              <Thumb key={it.id} item={it} />
            ))}
          </Grid>
        </div>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {editable && <UploadForm action={uploadMedia.bind(null, treeId)} withOccasion />}

      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
        <div className="h-2 w-40 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-brand-600)" }} />
        </div>
        {humanBytes(usage)} of {humanBytes(TREE_QUOTA_BYTES)} · {items.length} files · {gallery.filed}{" "}
        filed
      </div>

      <Tabs items={tabs} />
    </div>
  );
}
