import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getPublicMemorial } from "@/lib/queries/memorial";
import { MediaThumb } from "@/components/media/MediaThumb";
import { Dialog } from "@/components/Dialog";
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

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
        <Link href="/" className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
          About
        </Link>
      </header>
      <div className="mt-8 flex-1">{children}</div>
      <footer className="mt-10 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        A memorial page on Family Compass.
      </footer>
    </main>
  );
}

export default async function MemorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ posted?: string; err?: string }>;
}) {
  const { slug } = await params;
  const { posted, err } = await searchParams;
  const m = await getPublicMemorial(slug);
  if (!m) notFound();
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

  const eulogyParas = (m.eulogy ?? "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const survivors = m.includeLiving ? m.survivors : [];

  return (
    <Frame>
      <article className="flex flex-col gap-6">
        {m.coverMediaId && (
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${m.coverMediaId}?v=thumb&m=${slug}`} alt={m.name} className="w-full object-cover" />
          </div>
        )}

        <div>
          <h1 className="font-serif text-3xl">{m.headline ?? m.name}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {m.name}
            {m.born ? ` · born ${m.born}` : ""}
            {m.died ? ` · died ${m.died}` : ""}
            {m.restingPlace ? ` · rests at ${m.restingPlace}` : ""}
          </p>
        </div>

        {eulogyParas.length > 0 && (
          <section className="flex flex-col gap-3 text-[15px] leading-relaxed">
            {eulogyParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {(survivors.length > 0 || m.preceded.length > 0) && (
          <section className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {survivors.length > 0 && (
              <p>
                <strong>Survived by:</strong> {survivors.join(", ")}
              </p>
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
            <h2 className="font-medium">Photos</h2>
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
          <section className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="font-medium">Funeral programme</h2>
            {m.program?.venue && <p className="mt-1">Venue: {m.program.venue}</p>}
            {m.program?.serviceDate && (
              <p>Date: {m.program.serviceDate.toISOString().slice(0, 10)}</p>
            )}
            {m.serviceText && <p className="mt-1 whitespace-pre-wrap">{m.serviceText}</p>}
            {m.program && m.program.order.length > 0 && (
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {m.program.order.map((it, i) => (
                  <li key={i}>
                    {it.title}
                    {it.detail ? <span style={{ color: "var(--muted)" }}> — {it.detail}</span> : null}
                  </li>
                ))}
              </ol>
            )}
            {m.program?.committee && (
              <p className="mt-2 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
                {m.program.committee}
              </p>
            )}
          </section>
        )}

        {/* Guestbook */}
        <section id="guestbook">
          <h2 className="font-medium">Guestbook</h2>
          {posted === "review" && (
            <p className="mt-1 text-sm text-green-700">Thank you — your message will show once approved.</p>
          )}
          {posted === "1" && <p className="mt-1 text-sm text-green-700">Thank you for your message.</p>}
          {err && <p className="mt-1 text-sm text-red-600">Please add your name and a message.</p>}

          <ul className="mt-3 flex flex-col gap-3">
            {m.guestbook.map((g) => (
              <li key={g.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="font-medium">
                  {g.name}
                  {g.relation ? <span style={{ color: "var(--muted)" }}> · {g.relation}</span> : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{g.message}</p>
              </li>
            ))}
            {m.guestbook.length === 0 && (
              <li className="text-sm" style={{ color: "var(--muted)" }}>
                Be the first to leave a message.
              </li>
            )}
          </ul>

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
                  <button className="mt-1 self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
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
      </article>
    </Frame>
  );
}
