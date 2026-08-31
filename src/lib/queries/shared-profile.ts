import { db } from "@/lib/db";
import { displayName, primaryName, presumedLiving } from "@/lib/person";
import { formatDate, dateSortKey } from "@/lib/date";

const NAME_SELECT = {
  first: true,
  surname: true,
  surnamePrefix: true,
  suffix: true,
  nick: true,
  title: true,
  preferred: true,
  type: true,
  order: true,
} as const;

export type SharedProfile =
  | { redacted: true; name: string }
  | {
      redacted: false;
      name: string;
      given: string;
      gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
      living: boolean;
      headline: string;
      clan: string | null;
      subClan: string | null;
      community: string | null;
      bornLine: string | null;
      diedLine: string | null;
      restingPlace: string | null;
      years: string | null;
      about: string | null;
      events: { type: string; date: string; place: string | null; note: string | null }[];
      photos: { id: string; mimeType: string }[];
      memorialSlug: string | null;
    };

/** The central person of a shared view, honouring the same redaction rules. */
export async function getSharedCentralProfile(
  treeId: string,
  personId: string,
  opts: { includeLiving: boolean },
): Promise<SharedProfile | null> {
  const p = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      gender: true,
      living: true,
      privacy: true,
      publicDatePrecision: true,
      hidePhotosPublic: true,
      subClan: true,
      clan: { select: { name: true, community: true } },
      names: { select: NAME_SELECT },
      memorial: { select: { slug: true, published: true, eulogy: true } },
      eventRefs: {
        select: {
          event: {
            select: {
              type: true,
              description: true,
              dateYear: true,
              dateMonth: true,
              dateDay: true,
              dateModifier: true,
              dateQuality: true,
              dateText: true,
              place: { select: { title: true } },
            },
          },
        },
      },
      mediaRefs: { select: { media: { select: { id: true, mimeType: true } } } },
    },
  });
  if (!p) return null;
  if (p.privacy === "PRIVATE") return null;
  if (p.privacy === "REDACTED") {
    const n = primaryName(p.names);
    return { redacted: true, name: displayName(p.names) || (n?.surname ? `${n.surname} family` : "Private") };
  }

  const name = displayName(p.names);
  const events = p.eventRefs.map((r) => r.event);
  const birth = events.find((e) => e.type === "Birth") ?? null;
  const death =
    events.find((e) => e.type === "Death") ?? events.find((e) => e.type === "Burial") ?? null;

  const living = presumedLiving({
    explicitLiving: p.living,
    birthYear: birth?.dateYear ?? null,
    deathYear: death?.dateYear ?? null,
    hasDeathEvent: !!death,
  });
  if (living && !opts.includeLiving) {
    const n = primaryName(p.names);
    return { redacted: true, name: n?.surname ? `Living ${n.surname}` : "Living family member" };
  }

  // Public-surface date precision. Members view this profile through the app,
  // not here, so this only ever narrows what a public link shows.
  const prec = p.publicDatePrecision;
  const pd = (e: { dateYear: number | null } & Record<string, unknown>): string =>
    prec === "NONE" ? "" : prec === "YEAR" ? (e.dateYear ? String(e.dateYear) : "") : formatDate(e as never);

  const born = birth ? pd(birth) : "";
  const died = death ? pd(death) : "";
  const bornPlace = birth?.place?.title ?? null;
  const diedPlace = death?.place?.title ?? null;
  const burial = events.find((e) => e.type === "Burial");
  const restingPlace = burial?.place?.title ?? null;
  const years =
    prec !== "NONE" && (birth?.dateYear || death?.dateYear)
      ? `${birth?.dateYear ?? "?"} – ${death?.dateYear ?? (living ? "present" : "?")}`
      : null;

  const headlineBits = [
    p.clan?.name ? `${p.clan.name} clan` : null,
    p.subClan,
    p.clan?.community,
    years,
  ].filter(Boolean) as string[];

  // About: first paragraph of a published eulogy, else a generated sentence.
  let about: string | null = null;
  if (p.memorial?.published && p.memorial.eulogy) {
    about = p.memorial.eulogy.split(/\n{2,}/)[0]?.trim() ?? null;
  }
  if (!about) {
    const s: string[] = [];
    if (born || bornPlace) s.push(`Born${born ? ` ${born}` : ""}${bornPlace ? ` in ${bornPlace}` : ""}.`);
    if (p.clan?.name) {
      s.push(
        `Of the ${p.clan.name}${p.subClan ? ` (${p.subClan})` : ""} clan${p.clan.community ? ` of the ${p.clan.community} community` : ""}.`,
      );
    }
    if (died) s.push(`Passed away ${died}${diedPlace ? ` at ${diedPlace}` : ""}.`);
    about = s.join(" ") || null;
  }

  const timeline = events
    .filter((e) => e.dateYear || e.dateText || e.place)
    .map((e) => ({
      type: e.type,
      date: pd(e),
      place: e.place?.title ?? null,
      note: e.description ?? null,
      _k: dateSortKey(e),
    }))
    .sort((a, b) => a._k.localeCompare(b._k))
    .map(({ _k, ...rest }) => {
      void _k;
      return rest;
    });

  return {
    redacted: false,
    name,
    given: primaryName(p.names)?.first ?? name.split(" ")[0] ?? name,
    gender: p.gender,
    living,
    headline: headlineBits.join("  ·  "),
    clan: p.clan?.name ?? null,
    subClan: p.subClan,
    community: p.clan?.community ?? null,
    bornLine: born || bornPlace ? [born, bornPlace].filter(Boolean).join(" · ") : null,
    diedLine: died || diedPlace ? [died, diedPlace].filter(Boolean).join(" · ") : null,
    restingPlace,
    years,
    about,
    events: timeline,
    photos: p.hidePhotosPublic
      ? []
      : p.mediaRefs.map((r) => r.media).filter((m) => m.mimeType.startsWith("image/")),
    memorialSlug: p.memorial?.published ? p.memorial.slug : null,
  };
}
