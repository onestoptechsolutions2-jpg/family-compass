import Link from "next/link";

import { getSessionUser } from "@/lib/rbac";
import { homePathForUser } from "@/lib/home";
import { publicShowcase } from "@/lib/queries/showcase";
import { PeanutArt } from "@/components/GradientArt";
import { ProofCarousel } from "@/components/ProofCarousel";
import { SiteFooter } from "@/components/SiteFooter";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata = {
  title: "Family Compass — the family you come from and the family you choose",
  description:
    "One person, one record — even when two families meet through marriage. Search before you add anyone; link instead of duplicating. Record your shared history together, memory by memory. A consent-first Kenyan genealogy & research project.",
};

/** The problem, spelled out concretely — not a mood, a list of things that
 *  actually go wrong with a spreadsheet, a photo album, or a one-owner tree. */
const PROBLEMS = [
  "Every family ends up with its own copy of the same grandmother — your cousin's tree and yours never meet, even though you're the same family.",
  "When two families connect through marriage, nobody has the full picture — just two disconnected trees that can't see each other.",
  "Knowledge lives in one elder's memory or one person's notebook. When it's gone, it's gone — nothing was ever shared or backed up.",
];

/** The solution, in exactly four dimensions — what this actually is, not a
 *  feature list. Order matches the priority a new user should feel it in. */
const SOLUTION = [
  {
    n: "1",
    k: "One person, one record",
    v: "Before you add anyone, we check if they're already recorded. Found them? You link to that same record instead of retyping it. Two families can now connect through a marriage without either one duplicating or inheriting the other's data.",
  },
  {
    n: "2",
    k: "Real relationships, not just names",
    v: "Grandparents, in-laws, nieces and nephews — worked out automatically from how people connect, including across a marriage into another family's tree. Ask \"how are we related?\" and get a real answer, not a guess.",
  },
  {
    n: "3",
    k: "History you build together",
    v: "A memory or a prompt reaches the other person, who adds their side. The record grows from both of you, not from whoever got to the keyboard first.",
  },
  {
    n: "4",
    k: "There when it matters most",
    v: "A memorial page, guestbook and printable eulogy book when someone passes. A welfare fund the family can contribute to. Automatic backups, so none of it is one failure away from gone.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  const appHref = user ? await homePathForUser(user.id) : null;
  const showcase = await publicShowcase();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">🧭 Family Compass</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/docs" className="hover:underline">Developers</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          {user ? (
            <Link href={appHref ?? "/app"} className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
              Open app
            </Link>
          ) : (
            <Link href="/login" className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* WHAT — the hook */}
      <section className="relative mt-8 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
        <PeanutArt variant="hero" className="absolute inset-0 h-full w-full opacity-70" />
        <div className="relative px-8 py-16 sm:px-12 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
            A living record of how families are made
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-[#3b2a1c] sm:text-5xl">
            Family is the people you share a history with.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#4a3728]">
            One place for the family you were born into and the family you chose — recorded
            together, and never duplicated when your families meet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={appHref ?? "/start"} className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
              {user ? "Open Family Compass" : "Start free"}
            </Link>
            <Link href="/about" className="rounded-lg border border-[#00000022] bg-white/70 px-5 py-3 font-medium text-[#3b2a1c] backdrop-blur">
              About the project
            </Link>
          </div>
        </div>
      </section>

      {/* The problem — spelled out, not implied */}
      <section className="mx-auto mt-14 max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          The problem
        </p>
        <h2 className="mt-2 font-serif text-2xl">
          Family history keeps getting lost, duplicated, or stuck in one person&apos;s head.
        </h2>
        <ul className="mx-auto mt-6 flex max-w-xl flex-col gap-3 text-left text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {PROBLEMS.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden style={{ color: "var(--color-brand-700)" }}>✕</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* The solution — four dimensions, no more */}
      <section className="mt-16">
        <p className="text-center text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          What Family Compass does about it
        </p>
        <h2 className="mx-auto mt-2 max-w-xl text-center font-serif text-2xl">
          One place, built four ways to hold a family together.
        </h2>
        <ol className="mx-auto mt-10 grid max-w-3xl gap-x-8 gap-y-8 text-left sm:grid-cols-2">
          {SOLUTION.map((s) => (
            <li key={s.n}>
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
                style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-2 font-medium">{s.k}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{s.v}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-xl text-center text-sm" style={{ color: "var(--muted)" }}>
          Consent-first, always: sharing and the research directory stay off until you turn them
          on. You keep ownership of everything you add — export or delete it any time.
        </p>
      </section>

      {/* Proof — who's already here */}
      {showcase.top.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-serif text-2xl">Families already mapping their history</h2>
              {showcase.totals && (
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  {showcase.totals.people.toLocaleString()} people recorded across{" "}
                  {showcase.totals.trees.toLocaleString()} family trees — and counting.
                </p>
              )}
            </div>
            <Link href="/discover" className="text-sm hover:underline" style={{ color: "var(--color-brand-700)" }}>
              See who&apos;s on Family Compass →
            </Link>
          </div>
          <div className="mt-5">
            <ProofCarousel trees={showcase.top} />
          </div>
        </section>
      )}

      <PeanutArt variant="strip" className="my-14 h-1.5 w-full rounded-full" />

      {/* Final call to action */}
      <section className="mt-16 rounded-2xl border px-8 py-12 text-center" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <h2 className="font-serif text-2xl">Start with yourself.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--muted)" }}>
          Add yourself, then your parents, then your children. Free to build and share — we search
          for you first, so you&apos;re never a duplicate.
        </p>
        <Link
          href={appHref ?? "/start"}
          className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
        >
          {user ? "Open Family Compass" : "Start free"}
        </Link>
      </section>

      <SiteFooter
        links={
          <>
            Building &amp; sharing free · print charts, deep search &amp; commissioned research paid ·{" "}
            <Link href="/policies" className="hover:underline">Policies</Link> ·{" "}
            <Link href="/docs" className="hover:underline">API &amp; webhooks</Link>
          </>
        }
      />

      <InstallPrompt />
    </main>
  );
}
