import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { normaliseOrder } from "@/lib/queries/memorial";
import { CONTRIBUTION_SECTIONS, sectionLabel } from "@/lib/memorial-sections";
import { submitContribution } from "./actions";

export const metadata: Metadata = { title: "Contribute to a memorial", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAME_SELECT = {
  first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true,
  preferred: true, type: true, order: true,
} as const;

const STATUS_LABEL: Record<string, { label: string; note: string }> = {
  DRAFT: {
    label: "Draft — open for contributions",
    note: "Add memories, life details and side notes freely — the family is still writing this.",
  },
  IN_REVIEW: {
    label: "In review",
    note: "The family is finalising the memorial. Corrections and short notes are still welcome.",
  },
  FINAL: {
    label: "Final",
    note: "This memorial has been finalised. You can still send a note; the family decides whether to reopen it.",
  },
};

export default async function ContributePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ sent?: string; err?: string }>;
}) {
  const { slug, token } = await params;
  const { sent, err } = await searchParams;

  const MEMORIAL_SELECT = {
    slug: true,
    headline: true,
    status: true,
    published: true,
    eulogy: true,
    bioNotes: true,
    program: { select: { order: true } },
    person: {
      select: { names: { select: NAME_SELECT }, _count: { select: { mediaRefs: true } } },
    },
  } as const;

  const contributor = await db.memorialContributor.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      relation: true,
      memorial: { select: MEMORIAL_SELECT },
      invitedBy: { select: { name: true } },
      contributions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, section: true, body: true, status: true, createdAt: true },
      },
    },
  });

  const groupMemorial =
    contributor && contributor.memorial.slug === slug
      ? null
      : await db.memorial.findFirst({ where: { groupContribToken: token, slug }, select: MEMORIAL_SELECT });

  if (!contributor && !groupMemorial) notFound();
  if (contributor && contributor.memorial.slug !== slug && !groupMemorial) notFound();

  const isGroup = !contributor;
  const m = contributor?.memorial ?? groupMemorial!;

  if (contributor) {
    db.memorialContributor.update({ where: { token }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const name = displayName(m.person.names);
  const status = STATUS_LABEL[m.status] ?? STATUS_LABEL.DRAFT!;
  const isDraft = m.status === "DRAFT";

  const bioKeys = m.bioNotes && typeof m.bioNotes === "object" ? Object.keys(m.bioNotes).length : 0;
  const gaps = [
    { done: (m.eulogy ?? "").trim().length > 200, title: "A life story / eulogy", pick: "memory" },
    { done: bioKeys >= 3, title: "Life details — education, work, faith, character", pick: "biography" },
    { done: m.person._count.mediaRefs > 0, title: "Photographs", pick: "other" },
    { done: normaliseOrder(m.program?.order).length > 0, title: "The order of service", pick: "programme" },
  ];
  const needed = gaps.filter((g) => !g.done);
  const defaultSection = needed[0]?.pick ?? (isDraft ? "note" : "memory");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="font-semibold">🧭 Family Compass</span>
        {m.published && (
          <Link href={`/m/${slug}?from=${token}`} className="text-sm hover:underline" style={{ color: "var(--link)" }}>
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
          {isGroup
            ? `This link was shared with your family group — add a memory, tribute or life detail for ${name}. `
            : `${contributor?.invitedBy?.name ? `${contributor.invitedBy.name} ` : "The family "}asked you to help with ${name}'s memorial. `}
          Every note is reviewed before it appears.
        </p>
      </div>

      <div
        className="mt-4 rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {status.label}
        </span>
        <span className="ml-2" style={{ color: "var(--muted)" }}>{status.note}</span>
      </div>

      {needed.length > 0 && (
        <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--hairline)" }}>
          <p className="font-medium">What the family still needs</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {gaps.map((g) => (
              <li key={g.title} className="flex items-start gap-2">
                <span style={{ color: g.done ? "var(--success)" : "var(--muted)" }}>{g.done ? "✓" : "•"}</span>
                <span style={g.done ? { color: "var(--muted)", textDecoration: "line-through" } : undefined}>
                  {g.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sent && (
        <p className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--success)" }}>
          Thank you — your contribution was sent to the family.
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
            required={isGroup}
            defaultValue={contributor?.name ?? ""}
            placeholder={isGroup ? "Your full name" : undefined}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>What are you adding?</span>
          <select
            name="section"
            defaultValue={defaultSection}
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
            placeholder={
              isDraft
                ? `A memory of ${name}, a life detail, or a side note for the family…`
                : `Write your note for ${name}…`
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          />
        </label>
        {err === "name" && <p className="text-sm" style={{ color: "var(--danger)" }}>Please add your name.</p>}
        {err && err !== "name" && <p className="text-sm" style={{ color: "var(--danger)" }}>Please write a little more.</p>}
        <button className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          Send to the family
        </button>
      </form>

      {contributor && contributor.contributions.length > 0 && (
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
