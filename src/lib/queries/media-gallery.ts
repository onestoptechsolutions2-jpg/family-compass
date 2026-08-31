import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { formatDate } from "@/lib/date";

export type GalleryItem = {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  caption: string | null;
};

export type GalleryGroup = {
  key: string;
  label: string;
  sublabel: string | null;
  href: string | null;
  items: GalleryItem[];
};

const EVENT_DATE_SELECT = {
  id: true,
  type: true,
  dateModifier: true,
  dateQuality: true,
  dateYear: true,
  dateMonth: true,
  dateDay: true,
  dateYear2: true,
  dateMonth2: true,
  dateDay2: true,
  dateText: true,
  place: { select: { title: true } },
} as const;

export type MediaGallery = {
  total: number;
  filed: number;
  byEvent: GalleryGroup[];
  byPerson: GalleryGroup[];
  byPlace: GalleryGroup[];
  byOccasion: GalleryGroup[];
  unfiled: GalleryItem[];
};

/**
 * The tree's media, organised into galleries: by event, by person, by place,
 * and by "occasion" (a free-text caption / date when nothing structured is
 * attached). One file can appear in several galleries. `unfiled` is everything
 * with no link and no occasion text.
 */
export async function mediaGallery(treeId: string): Promise<MediaGallery> {
  const media = await db.mediaObject.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      dateText: true,
      refs: {
        select: {
          caption: true,
          person: { select: { id: true, names: { select: NAME_SELECT } } },
          event: { select: EVENT_DATE_SELECT },
          place: { select: { id: true, title: true } },
        },
      },
    },
  });

  const byEvent = new Map<string, GalleryGroup>();
  const byPerson = new Map<string, GalleryGroup>();
  const byPlace = new Map<string, GalleryGroup>();
  const byOccasion = new Map<string, GalleryGroup>();
  const unfiled: GalleryItem[] = [];

  const add = (
    map: Map<string, GalleryGroup>,
    key: string,
    label: string,
    sublabel: string | null,
    href: string | null,
    item: GalleryItem,
  ) => {
    let g = map.get(key);
    if (!g) {
      g = { key, label, sublabel, href, items: [] };
      map.set(key, g);
    }
    if (!g.items.some((x) => x.id === item.id)) g.items.push(item);
  };

  let filed = 0;

  for (const m of media) {
    const base: GalleryItem = {
      id: m.id,
      title: m.title,
      fileName: m.fileName,
      mimeType: m.mimeType,
      caption: null,
    };

    const linked = m.refs.some((r) => r.person || r.event || r.place);
    if (linked) filed += 1;

    if (m.refs.length === 0) {
      const occ = (m.dateText ?? "").trim();
      if (occ) add(byOccasion, occ.toLowerCase(), occ, null, null, base);
      else unfiled.push(base);
      continue;
    }

    let placedSomewhere = false;
    for (const r of m.refs) {
      const item: GalleryItem = { ...base, caption: r.caption ?? null };

      if (r.event) {
        const when = formatDate(r.event);
        const sub = [when, r.event.place?.title].filter(Boolean).join(" · ") || null;
        add(byEvent, r.event.id, r.event.type, sub, null, item);
        placedSomewhere = true;
      }
      if (r.person) {
        add(
          byPerson,
          r.person.id,
          displayName(r.person.names),
          null,
          `/trees/${treeId}/people/${r.person.id}`,
          item,
        );
        placedSomewhere = true;
      }
      if (r.place) {
        add(byPlace, r.place.id, r.place.title, null, null, item);
        placedSomewhere = true;
      }
      if (!r.event && !r.person && !r.place && r.caption?.trim()) {
        const occ = r.caption.trim();
        add(byOccasion, occ.toLowerCase(), occ, null, null, item);
        placedSomewhere = true;
      }
    }
    if (!placedSomewhere) {
      const occ = (m.dateText ?? "").trim();
      if (occ) add(byOccasion, occ.toLowerCase(), occ, null, null, base);
      else unfiled.push(base);
    }
  }

  const ordered = (map: Map<string, GalleryGroup>) =>
    [...map.values()].sort(
      (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label),
    );

  return {
    total: media.length,
    filed,
    byEvent: ordered(byEvent),
    byPerson: ordered(byPerson),
    byPlace: ordered(byPlace),
    byOccasion: ordered(byOccasion),
    unfiled,
  };
}
