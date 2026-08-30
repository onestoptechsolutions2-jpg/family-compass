import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { CONTRIBUTION_SECTIONS, sectionLabel } from "@/lib/memorial-sections";
import { submitContribution } from "./actions";

export const metadata: Metadata = { title: "Contribute to a memorial", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAME_SELECT = {
  first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true,
  preferred: true, type: true, order: true,
} as const;

export default async function ContributePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ sent?: string; err?: string }>;
}) {
  const { slug, token } = await params;
  const { sent, err } = await searchParams;

  const contributor = await db.memorialContributor.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      relation: true,
      memorial: {
        select: {
          slug: true,
          headline: true,
          status: true,
          published: true,
          person: { select: { names: { select: NAME_SELECT } } },
        },
      },
      invitedBy: { select: { name: true } },
      contributions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, section: true, body: true, status: true, createdAt: true },
      },
    },
  });

  if (!contributor || contributor.memorial.slug !== slug) notFound();

  // record that the collaborator opened the link
  db.memorialContributor
    .update({ where: { token }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  const m = contributor.memorial;
  const name = displayName(m.person.names);
  const isFinal = m.status === "FINAL";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
        {m.published && (
          <Link href={`/m/${slug}`} className="text-sm hover:underline" style={{ color: "var(--link)" }}>
            View memorial
          </Link>
        )}
      </header>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
          You&apos;ve been invited to contribute
        </p>
        <h1 className="mt-1 font-serif text-2xl">{m.headline ?? `In memory of ${name}`}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {contributor.invitedBy?.name ? `${contributor.invitedBy.name} ` : "The family "}
          asked you to add a memory, tribute or correction for <strong>{name}</strong>&apos;s memorial.
          The family reviews each note before it appears.
        </p>
      </div>

      {sent && (
        <p className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--success)" }}>
          Thank you — your contribution was sent to the family.
        </p>
      )}
      {isFinal && (
        <p className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}>
          This memorial has been finalised. You can still send a note; the family will decide whether
          to reopen it.
        </p>
      )}

      <form
        action={submitContribution.bind(null, slug, token)}
        className="mt-5 flex flex-col gap-3 rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
      >
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Your name</span>
          <input
            name="authorName"
            defaultValue={contributor.name}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>What are you adding?</span>
          <select
            name="section"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            {CONTRIBUTION_SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Your words</span>
          <textarea
            name="body"
            required
            rows={7}
            placeholder={`Write your memory of ${name}…`}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          />
        </label>
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>Please write a little more.</p>}
        <button className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          Send to the family
        </button>
      </form>

      {contributor.contributions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium">Your contributions</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {contributor.contributions.map((c) => (
              <li key={c.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>{sectionLabel(c.section)}</span>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color:
                        c.status === "ACCEPTED" ? "var(--success)" : c.status === "DECLINED" ? "var(--danger)" : "var(--muted)",
                    }}
                  >
                    {c.status === "SUBMITTED" ? "awaiting review" : c.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        Shared privately with you via Family Compass.
      </footer>
    </main>
  );
}
