import { Avatar } from "@/components/profile/Avatar";

/** LinkedIn-style profile header: gradient banner, overlapping avatar,
 *  name + headline + location, and an actions slot. */
export function ProfileHero({
  name,
  headline,
  gender,
  photoId,
  photoMime,
  share,
  primaryLine,
  secondaryLine,
  badges = [],
  actions,
}: {
  name: string;
  headline?: string | null;
  gender?: string;
  photoId?: string | null;
  photoMime?: string | null;
  share?: string;
  primaryLine?: string | null;
  secondaryLine?: string | null;
  badges?: string[];
  actions?: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="h-32 w-full sm:h-40"
        style={{
          background:
            "linear-gradient(120deg, var(--hero-from) 0%, var(--hero-via) 55%, var(--hero-to) 100%)",
        }}
      />
      <div className="px-5 pb-5 sm:px-7">
        <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-14">
          <Avatar
            name={name}
            gender={gender}
            mediaId={photoId}
            mimeType={photoMime}
            share={share}
            size={104}
            ring
          />
          {actions && <div className="mb-1 flex flex-wrap gap-2">{actions}</div>}
        </div>

        <h1 className="mt-3 font-serif text-2xl leading-tight sm:text-3xl">{name}</h1>
        {headline && (
          <p className="mt-1 text-sm font-medium" style={{ color: "var(--accent)" }}>
            {headline}
          </p>
        )}
        {primaryLine && (
          <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
            {primaryLine}
          </p>
        )}
        {secondaryLine && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {secondaryLine}
          </p>
        )}
        {badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
