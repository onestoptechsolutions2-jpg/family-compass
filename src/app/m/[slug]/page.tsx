import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getPublicMemorial, groupByDay } from "@/lib/queries/memorial";
import { mapsHref } from "@/lib/geo";
import { RecentMemorials } from "@/components/RecentMemorials";
import { publicOrigin } from "@/lib/origin";
import { templateTheme } from "@/lib/memorial-templates";
import { MediaThumb } from "@/components/media/MediaThumb";
import { Dialog } from "@/components/Dialog";
import { SaveMemorial } from "@/components/SaveMemorial";
import { postGuestbook } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = await getPublicMemorial(slug);
  if (!m || !m.published) return { title: "Memorial" };
  return { title: `${m.headline ?? m.name}`, robots: { index: false } };
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return d.toISOString().slice(0, 10);
}

const monogram = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "•";

export default async function MemorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ posted?: string; err?: string; rel?: string; new?: string }>;
}) {
  const { slug } = await params;
  const { posted, err, rel, new: isNew } = await searchParams;
  const m = await getPublicMemorial(slug);
  if (!m) notFound();

  const theme = templateTheme(m.template);

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <main
      className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8"
      style={{ ...theme.wrapper, color: "var(--fg)" }}
    >
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
        <Link href="/" className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
          About
        </Link>
      </header>
      <div className="mt-8 flex-1">{children}</div>
      <footer className="mt-10 flex flex-col gap-3 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <RecentMemorials exceptSlug={slug} />
        <span>A memorial page on Family Compass.</span>
      </footer>
    </main>
  );

  if (!m.published) {
    return (
      <Frame>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This memorial isn&apos;t published yet.
        </p>
      </Frame>
    );
  }

  db.memorial.update({ where: { id: m.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const origin = await publicOrigin();
  const url = `${origin}/m/${slug}`;
  const eulogyParas = (m.eulogy ?? "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const survivors = m.includeLiving ? m.survivors : [];
  const cardStyle = theme.card;
  const coverSrc = m.coverMediaId ? `/api/media/${m.coverMediaId}?v=thumb&m=${slug}` : null;

  const Hero = () => {
    const sub = (
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {m.name}
        {m.born ? ` · born ${m.born}` : ""}
        {m.died ? ` · died ${m.died}` : ""}
        {m.restingPlace ? ` · rests at ${m.restingPlace}` : ""}
      </p>
    );

    if (theme.hero === "minimal") {
      return (
        <div className="flex items-center gap-3">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full text-lg font-semibold text-white"
            style={{ background: theme.accent }}
          >
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt={m.name} className="h-full w-full object-cover" />
            ) : (
              monogram(m.name)
            )}
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">{m.headline ?? m.name}</h1>
            {sub}
          </div>
        </div>
      );
    }

    if (theme.hero === "gradient") {
      return (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-3xl px-6 py-14 text-center text-white"
            style={{ background: "linear-gradient(135deg, #635bff 0%, #43c6ac 55%, #f78ca0 100%)" }}
          >
            <h1 className="text-3xl font-bold sm:text-4xl">{m.headline ?? m.name}</h1>
            <p className="mt-2 text-white/85">{m.name}{m.born || m.died ? ` · ${[m.born, m.died].filter(Boolean).join(" – ")}` : ""}</p>
          </div>
          {coverSrc && (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt={m.name} className="w-full object-cover" />
            </div>
          )}
        </div>
      );
    }

    if (theme.hero === "banner") {
      return (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="h-28 w-full" style={{ background: `linear-gradient(120deg, ${theme.accent}, color-mix(in srgb, ${theme.accent} 55%, #000))` }} />
          <div className="px-5 pb-5">
            <span
              className="-mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-full text-xl font-semibold text-white"
              style={{ background: theme.accent, boxShadow: "0 0 0 4px var(--surface)" }}
            >
              {coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverSrc} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                monogram(m.name)
              )}
            </span>
            <h1 className="mt-3 text-2xl font-bold leading-tight">{m.headline ?? m.name}</h1>
            {sub}
          </div>
        </div>
      );
    }

    // band (classic)
    return (
      <div className="flex flex-col gap-4">
        {coverSrc && (
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverSrc} alt={m.name} className="w-full object-cover" />
          </div>
        )}
        <div>
          <h1 className="text-3xl" style={{ fontFamily: theme.headingFont }}>{m.headline ?? m.name}</h1>
          {sub}
        </div>
      </div>
    );
  };

  return (
    <Frame>
      <article className="flex flex-col gap-6">
        <Hero />

        {eulogyParas.length > 0 && (
          <section className="flex flex-col gap-3 text-[15px] leading-relaxed">
            <h2 className="text-lg" style={{ fontFamily: theme.headingFont }}>Eulogy</h2>
            {eulogyParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {(survivors.length > 0 || m.preceded.length > 0) && (
          <section className="p-4 text-sm" style={cardStyle}>
            {survivors.length > 0 && (
              <p><strong>Survived by:</strong> {survivors.join(", ")}</p>
            )}
            {m.preceded.length > 0 && (
              <p className={survivors.length ? "mt-1" : ""}>
                <strong>Preceded in death by:</strong> {m.preceded.join(", ")}
              </p>
            )}
          </section>
        )}

        {m.photos.length > 0 && (
          <section>
            <h2 className="font-medium" style={{ fontFamily: theme.headingFont }}>Photos</h2>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {m.photos.map((ph) => (
                <div key={ph.id} className="aspect-square overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <MediaThumb mediaId={ph.id} mimeType={ph.mimeType} alt="" share={undefined} />
                </div>
              ))}
            </div>
          </section>
        )}

        {(m.program || m.serviceText) && (
          <section className="p-4 text-sm" style={cardStyle}>
            <h2 className="font-medium" style={{ fontFamily: theme.headingFont }}>Funeral programme</h2>
            {m.program?.venue && (
              <p className="mt-1">
                Venue: {m.program.venue}
                {mapsHref({ lat: m.program.venueLat, lng: m.program.venueLng, url: m.program.venueMapUrl }) && (
                  <>
                    {" · "}
                    <a
                      href={mapsHref({ lat: m.program.venueLat, lng: m.program.venueLng, url: m.program.venueMapUrl })!}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--link)" }}
                      className="hover:underline"
                    >
                      📍 open in maps
                    </a>
                  </>
                )}
              </p>
            )}
            {!m.program?.venue && mapsHref({ lat: m.program?.venueLat, lng: m.program?.venueLng, url: m.program?.venueMapUrl }) && (
              <p className="mt-1">
                <a
                  href={mapsHref({ lat: m.program!.venueLat, lng: m.program!.venueLng, url: m.program!.venueMapUrl })!}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--link)" }}
                  className="hover:underline"
                >
                  📍 Venue location
                </a>
              </p>
            )}
            {m.program?.serviceDate && <p>Date: {m.program.serviceDate.toISOString().slice(0, 10)}</p>}
            {m.serviceText && <p className="mt-1 whitespace-pre-wrap">{m.serviceText}</p>}
            {m.program && m.program.order.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                {groupByDay(m.program.order).map((g) => (
                  <div key={g.day}>
                    {(groupByDay(m.program!.order).length > 1 || g.day !== "Programme") && (
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                        {g.day}
                      </div>
                    )}
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                      {g.items.map((it) => (
                        <li key={it.id}>
                          {it.title}
                          {it.detail ? <span style={{ color: "var(--muted)" }}> — {it.detail}</span> : null}
                          {mapsHref({ lat: it.lat, lng: it.lng, url: it.mapUrl }) && (
                            <>
                              {" "}
                              <a
                                href={mapsHref({ lat: it.lat, lng: it.lng, url: it.mapUrl })!}
                                target="_blank"
                                rel="noreferrer"
                                title="Open location"
                              >
                                📍
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            {m.program?.committee && (
              <p className="mt-2 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{m.program.committee}</p>
            )}
          </section>
        )}

        {/* Tributes */}
        <section id="guestbook">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium" style={{ fontFamily: theme.headingFont }}>Tributes</h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {m.guestbook.length} {m.guestbook.length === 1 ? "message" : "messages"}
            </span>
          </div>

          {(posted === "review" || posted === "1") && (
            <div className="mt-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
              <p style={{ color: "var(--success)" }}>
                {posted === "review"
                  ? "Thank you — your message will show once a family member approves it."
                  : "Thank you for your message."}
              </p>
              {rel && (
                <p className="mt-1">
                  We found you in the family tree — recorded as <strong>{rel}</strong> of {m.name}.
                </p>
              )}
              {isNew && (
                <p className="mt-1" style={{ color: "var(--muted)" }}>
                  Not in this family&apos;s tree?{" "}
                  <Link href="/start" className="hover:underline" style={{ color: "var(--link)" }}>
                    Build your own on Family Compass →
                  </Link>
                </p>
              )}
            </div>
          )}
          {err && <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>Please add your name and a message.</p>}

          {theme.feed ? (
            <ul className="mt-3 flex flex-col">
              {m.guestbook.map((g) => (
                <li key={g.id} className="flex gap-3 py-3" style={{ borderTop: "1px solid var(--hairline)" }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: theme.accent }}>
                    {monogram(g.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{g.name}</span>
                      {g.relation ? <span style={{ color: "var(--muted)" }}> · {g.relation}</span> : null}
                      <span style={{ color: "var(--muted)" }}> · {timeAgo(g.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{g.message}</p>
                  </div>
                </li>
              ))}
              {m.guestbook.length === 0 && (
                <li className="py-3 text-sm" style={{ color: "var(--muted)" }}>Be the first to leave a message.</li>
              )}
            </ul>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {m.guestbook.map((g) => (
                <li key={g.id} className="p-3 text-sm" style={cardStyle}>
                  <div className="font-medium">
                    {g.name}
                    {g.relation ? <span style={{ color: "var(--muted)" }}> · {g.relation}</span> : null}
                    <span style={{ color: "var(--muted)" }}> · {timeAgo(g.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{g.message}</p>
                </li>
              ))}
              {m.guestbook.length === 0 && (
                <li className="text-sm" style={{ color: "var(--muted)" }}>Be the first to leave a message.</li>
              )}
            </ul>
          )}

          {m.guestbookOpen && (
            <div className="mt-4">
              <Dialog
                title={`Leave a message for ${m.name}`}
                label="✍️ Sign the guestbook"
                buttonClass="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <form action={postGuestbook.bind(null, slug)} className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span style={{ color: "var(--muted)" }}>Your name</span>
                      <input name="name" required placeholder="Full name" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
                    </label>
                    <label className="text-sm">
                      <span style={{ color: "var(--muted)" }}>Relation (optional)</span>
                      <input name="relation" placeholder="e.g. nephew, friend" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
                    </label>
                  </div>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Your message</span>
                    <textarea name="message" required rows={4} placeholder="Share a memory or a word of comfort" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Phone (optional, never shown)</span>
                    <input name="phone" placeholder="+2547…" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
                  </label>
                  <button className="mt-1 self-start rounded-full px-5 py-2.5 text-sm font-medium text-white" style={{ background: theme.accent }}>
                    Post message
                  </button>
                  {m.guestbookModerated && (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Messages appear after a family member approves them.
                    </p>
                  )}
                </form>
              </Dialog>
            </div>
          )}
        </section>

        <div className="mt-4 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          <SaveMemorial url={url} pdfUrl={`${url}/pdf`} name={m.name} />
        </div>
      </article>
    </Frame>
  );
}
