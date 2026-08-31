import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getPublicMemorial, groupByDay } from "@/lib/queries/memorial";
import { mapsHref } from "@/lib/geo";
import { RecentMemorials } from "@/components/RecentMemorials";
import { publicOrigin } from "@/lib/origin";
import { templateTheme } from "@/lib/memorial-templates";
import { chamaEnabled } from "@/lib/chama/plugin";
import { MediaThumb } from "@/components/media/MediaThumb";
import { Dialog } from "@/components/Dialog";
import { SaveMemorial } from "@/components/SaveMemorial";
import { FLOWER_KINDS, flowerEmoji, TRIBUTE_REACTIONS } from "@/lib/memorial-flowers";
import { postGuestbook, layFlower, reactToTribute, replyToTribute } from "./actions";

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
  searchParams: Promise<{ posted?: string; err?: string; rel?: string; new?: string; flower?: string; from?: string }>;
}) {
  const { slug } = await params;
  const { posted, err, rel, new: isNew, flower, from } = await searchParams;
  const backToken = from && /^[A-Za-z0-9_-]{6,}$/.test(from) ? from : null;
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

  // one combined tribute feed: laid flowers + guestbook messages, newest first
  type Reply = { id: string; name: string; message: string; at: Date };
  type FeedItem =
    | { kind: "flower"; id: string; at: Date; name: string; emoji: string }
    | {
        kind: "message";
        id: string;
        at: Date;
        name: string;
        relation: string | null;
        message: string;
        replies: Reply[];
        reactions: Record<string, number>;
      };
  const feed: FeedItem[] = [
    ...m.flowers.map((f) => ({
      kind: "flower" as const,
      id: f.id,
      at: f.createdAt,
      name: f.name ?? "In loving memory",
      emoji: flowerEmoji(f.kind),
    })),
    ...m.guestbook.map((g) => {
      const reactions: Record<string, number> = {};
      for (const r of g.reactions) reactions[r.emoji] = (reactions[r.emoji] ?? 0) + 1;
      return {
        kind: "message" as const,
        id: g.id,
        at: g.createdAt,
        name: g.name,
        relation: g.relation,
        message: g.message,
        replies: g.replies.map((r) => ({ id: r.id, name: r.name, message: r.message, at: r.createdAt })),
        reactions,
      };
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const tributeCount = m.guestbook.length + m._count.flowers;
  const flowerCounts: Record<string, number> = {};
  for (const f of m.flowers) flowerCounts[f.kind] = (flowerCounts[f.kind] ?? 0) + 1;
  const coverSrc = m.coverMediaId ? `/api/media/${m.coverMediaId}?v=thumb&m=${slug}` : null;

  const messageForm = (
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
  );

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
        {backToken && (
          <Link
            href={`/m/${slug}/contribute/${backToken}`}
            className="self-start text-sm hover:underline"
            style={{ color: "var(--link)" }}
          >
            ← Back to your contribution
          </Link>
        )}

        <Hero />

        {/* reactions + guestbook — one-tap tributes, right under the name */}
        <div className="flex flex-wrap items-center gap-2">
          <form action={layFlower.bind(null, slug)} className="flex flex-wrap items-center gap-2">
            {FLOWER_KINDS.map((k) => {
              const n = flowerCounts[k.id] ?? 0;
              return (
                <button
                  key={k.id}
                  name="kind"
                  value={k.id}
                  title={k.label}
                  className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <span className="text-base leading-none">{k.emoji}</span>
                  {n > 0 && <span style={{ color: "var(--muted)" }}>{n}</span>}
                </button>
              );
            })}
          </form>
          {m.guestbookOpen && (
            <Dialog
              title={`Leave a message for ${m.name}`}
              label={`📖 Guestbook · ${m.guestbook.length}`}
              buttonClass="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm"
            >
              {messageForm}
            </Dialog>
          )}
          <Link href="#tributes" className="ml-auto text-xs hover:underline" style={{ color: "var(--link)" }}>
            all tributes →
          </Link>
        </div>

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

        {chamaEnabled() && m.welfareFund && (
          <section className="p-4 text-sm" style={cardStyle}>
            <h2 className="font-medium" style={{ fontFamily: theme.headingFont }}>Family welfare fund</h2>
            <p className="mt-1">
              <strong>KES {m.welfareFund.raisedKes.toLocaleString("en-KE")}</strong>
              {m.welfareFund.targetKes ? ` raised of KES ${m.welfareFund.targetKes.toLocaleString("en-KE")}` : " raised so far"}
              {" — "}
              {m.welfareFund.open
                ? "the family is collecting toward funeral costs."
                : "this fund is now closed. Thank you."}
            </p>
            {m.welfareFund.open && (
              <Link
                href={`/give/${m.welfareFund.token}`}
                className="mt-2 inline-block rounded-full px-4 py-1.5 text-sm font-medium text-white"
                style={{ background: theme.accent }}
              >
                Contribute to the fund →
              </Link>
            )}
          </section>
        )}

        {/* Tributes — flowers + messages, one feed */}
        <section id="tributes">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium" style={{ fontFamily: theme.headingFont }}>Tributes</h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {tributeCount} {tributeCount === 1 ? "tribute" : "tributes"}
            </span>
          </div>

          {/* quick actions live under the name; this repeats the guestbook opener for readers who scrolled */}
          {m.guestbookOpen && (
            <div className="mt-3">
              <Dialog
                title={`Leave a message for ${m.name}`}
                label="✍️ Write a message"
                buttonClass="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                {messageForm}
              </Dialog>
            </div>
          )}

          {flower === "1" && (
            <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Thank you — your tribute has been laid.</p>
          )}
          {flower === "cap" && (
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>You&apos;ve laid plenty for now — thank you.</p>
          )}

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

          {(() => {
            const flowerLine = (it: Extract<FeedItem, { kind: "flower" }>) => (
              <li key={it.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--hairline)" }}>
                <span className="w-9 text-center text-lg">{it.emoji}</span>
                <span>
                  <span className="font-medium">{it.name}</span>
                  <span style={{ color: "var(--muted)" }}> laid a tribute · {timeAgo(it.at)}</span>
                </span>
              </li>
            );

            const messageCard = (
              it: Extract<FeedItem, { kind: "message" }>,
              interactive: boolean,
            ) => {
              const reactionTotal = Object.values(it.reactions).reduce((a, b) => a + b, 0);
              return (
                <li key={it.id} className="flex gap-3 py-3" style={{ borderTop: "1px solid var(--hairline)" }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: theme.accent }}>
                    {monogram(it.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{it.name}</span>
                      {it.relation ? <span style={{ color: "var(--muted)" }}> · {it.relation}</span> : null}
                      <span style={{ color: "var(--muted)" }}> · {timeAgo(it.at)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{it.message}</p>

                    {interactive ? (
                      <form action={reactToTribute.bind(null, slug, it.id)} className="mt-1.5 flex flex-wrap items-center gap-1">
                        {TRIBUTE_REACTIONS.map((e) => (
                          <button
                            key={e}
                            name="emoji"
                            value={e}
                            className="rounded-full border px-2 py-0.5 text-sm leading-none"
                            style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
                            title="React"
                          >
                            {e}
                            {it.reactions[e] ? <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>{it.reactions[e]}</span> : null}
                          </button>
                        ))}
                      </form>
                    ) : (
                      reactionTotal > 0 && (
                        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                          {Object.entries(it.reactions).map(([e, n]) => `${e} ${n}`).join("  ")}
                        </p>
                      )
                    )}

                    {it.replies.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1.5 border-l pl-3" style={{ borderColor: "var(--hairline)" }}>
                        {it.replies.map((r) => (
                          <li key={r.id} className="text-sm">
                            <span className="font-medium">{r.name}</span>
                            <span style={{ color: "var(--muted)" }}> · {timeAgo(r.at)}</span>
                            <p className="whitespace-pre-wrap">{r.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    {interactive && m.guestbookOpen && (
                      <form action={replyToTribute.bind(null, slug, it.id)} className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          name="name"
                          required
                          placeholder="Your name"
                          className="w-full rounded-lg border px-2.5 py-1.5 text-sm sm:w-40"
                          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                        />
                        <input
                          name="message"
                          required
                          placeholder="Reply…"
                          className="w-full flex-1 rounded-lg border px-2.5 py-1.5 text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                        />
                        <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: theme.accent }}>
                          Reply
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            };

            const preview = feed.slice(0, 8);
            return (
              <>
                {feed.length > 0 && (
                  <div className="mt-2">
                    <Dialog wide title={`Tributes for ${m.name}`} label={`💬 Open the tribute wall · ${tributeCount}`} buttonClass="rounded-full border px-3 py-1.5 text-sm" >
                      <ul className="flex flex-col">
                        {feed.map((it) => (it.kind === "flower" ? flowerLine(it) : messageCard(it, true)))}
                      </ul>
                    </Dialog>
                  </div>
                )}
                <ul className="mt-3 flex flex-col">
                  {preview.map((it) => (it.kind === "flower" ? flowerLine(it) : messageCard(it, false)))}
                  {feed.length === 0 && (
                    <li className="py-3 text-sm" style={{ color: "var(--muted)" }}>Be the first to leave a tribute.</li>
                  )}
                  {feed.length > preview.length && (
                    <li className="py-2 text-sm" style={{ color: "var(--muted)" }}>
                      + {feed.length - preview.length} more — open the tribute wall to react and reply.
                    </li>
                  )}
                </ul>
              </>
            );
          })()}
        </section>

        <div className="mt-4 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          <SaveMemorial url={url} pdfUrl={`${url}/pdf`} name={m.name} />
        </div>
      </article>
    </Frame>
  );
}
