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

/** HOW: the mechanism, in the order a new user actually hits it. */
const HOW_STEPS = [
  {
    n: "1",
    k: "Search first",
    v: "Before you add anyone, we check if they're already recorded — in your family, or one you've never met.",
  },
  {
    n: "2",
    k: "Link, don't duplicate",
    v: "Already there? You connect to that same record. Nothing gets re-typed, nothing gets forked.",
  },
  {
    n: "3",
    k: "Your tree is your view",
    v: "Marrying into another family connects the two networks — without either one inheriting the other's data or editors.",
  },
];

/** Minimal diagram: the same person, linked (not duplicated) across two family trees. */
function IdentityDiagram() {
  return (
    <svg
      viewBox="0 0 640 176"
      className="mx-auto w-full max-w-xl"
      role="img"
      aria-label="Joash appears in both the Otieno family tree and his cousin's family tree, linked as one person instead of duplicated"
    >
      <rect x="12" y="12" width="216" height="152" rx="18" fill="none" stroke="var(--border)" strokeWidth="1.5" />
      <text x="32" y="38" style={{ fontSize: 11, letterSpacing: "0.08em", fill: "var(--muted)" }}>
        OTIENO FAMILY
      </text>
      <circle cx="120" cy="104" r="26" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
      <text x="120" y="109" textAnchor="middle" style={{ fontSize: 12, fill: "var(--fg)" }}>
        Joash
      </text>

      <rect x="412" y="12" width="216" height="152" rx="18" fill="none" stroke="var(--border)" strokeWidth="1.5" />
      <text x="432" y="38" style={{ fontSize: 11, letterSpacing: "0.08em", fill: "var(--muted)" }}>
        COUSIN&apos;S FAMILY
      </text>
      <circle cx="520" cy="104" r="26" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
      <text x="520" y="109" textAnchor="middle" style={{ fontSize: 12, fill: "var(--fg)" }}>
        Joash
      </text>

      <line x1="148" y1="104" x2="492" y2="104" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
      <circle cx="320" cy="104" r="19" fill="var(--primary)" />
      <text x="320" y="109" textAnchor="middle" style={{ fontSize: 13, fill: "var(--primary-fg)" }}>
        =
      </text>
      <text x="320" y="144" textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted)" }}>
        one person, one record
      </text>
    </svg>
  );
}

/** WHO: the two kinds of family this holds, side by side. */
const WHO_POINTS = [
  { k: "The family you come from", v: "Parents, grandparents, the lineage and clan you were born into — recorded the way your family actually remembers it." },
  { k: "The family you choose", v: "Friends, mentors, the aunty who isn't blood. Start your own tree, centred on you, and invite whoever counts as family." },
];

/** WHAT: what you can actually do here, trimmed to the essentials. */
const WHAT_YOU_CAN_DO = [
  { title: "Record the bond together", body: "Add a memory or answer a prompt — it reaches the other person, who adds their side. The connection is what you both put in." },
  { title: "Check if you're related", body: "See a shared bloodline or clan before a relationship. Paid deep search extends the check to other families that opted in." },
  { title: "Memorials & eulogy books", body: "When someone passes, open a tribute page: guestbook, an auditable funeral programme, and a printable eulogy book." },
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

      {/* WHY — the problem this solves */}
      <section className="mx-auto mt-14 max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          Why this exists
        </p>
        <h2 className="mt-2 font-serif text-2xl">
          Every family ends up with its own version of the same person.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
          Two branches enter the same grandmother twice. Your cousin&apos;s tree and yours never
          meet, even though you&apos;re the same family. Elders&apos; knowledge fades because
          nobody holds the whole picture — only scattered pieces of it.
        </p>
      </section>

      {/* HOW — the mechanism */}
      <section className="mt-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          How it works
        </p>
        <h2 className="mx-auto mt-2 max-w-xl font-serif text-2xl">
          One person. One record. However many families are looking.
        </h2>

        <div className="mt-8">
          <IdentityDiagram />
        </div>

        <ol className="mx-auto mt-10 grid max-w-3xl gap-x-8 gap-y-6 text-left sm:grid-cols-3">
          {HOW_STEPS.map((s) => (
            <li key={s.n}>
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
                style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-2 font-medium">{s.k}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{s.v}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* WHO — the audience */}
      <section className="mt-16">
        <p className="text-center text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          Who it&apos;s for
        </p>
        <h2 className="mx-auto mt-2 max-w-xl text-center font-serif text-2xl">
          The family you come from, and the family you choose.
        </h2>
        <div className="mx-auto mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
          {WHO_POINTS.map((x) => (
            <div key={x.k}>
              <h3 className="font-medium">{x.k}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{x.v}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-sm" style={{ color: "var(--muted)" }}>
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

      {/* WHAT you can do */}
      <section>
        <p className="text-center text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          What you can do
        </p>
        <div className="mx-auto mt-6 grid max-w-3xl gap-6 sm:grid-cols-3">
          {WHAT_YOU_CAN_DO.map((f) => (
            <div key={f.title}>
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

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
