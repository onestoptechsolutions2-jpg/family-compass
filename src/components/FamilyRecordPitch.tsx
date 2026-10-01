import Link from "next/link";

import { getSessionUser } from "@/lib/rbac";
import { homePathForUser } from "@/lib/home";
import { publicShowcase } from "@/lib/queries/showcase";
import { PeanutArt } from "@/components/GradientArt";
import { ProofCarousel } from "@/components/ProofCarousel";

/** The problem, spelled out concretely — a bold, specific claim per item,
 *  then the one line that backs it up. Not a mood, a list of things that
 *  actually go wrong with a spreadsheet, a photo album, or a one-owner tree. */
const PROBLEMS = [
  {
    k: "Every family ends up with its own copy of the same grandmother.",
    v: "Your cousin's tree and yours never meet, even though you're the same family — each side re-enters her from scratch.",
  },
  {
    k: "Nobody has the full picture once two families connect.",
    v: "A marriage joins two families in life, but on paper it's still two disconnected trees that can't see each other.",
  },
  {
    k: "Updates get buried in a WhatsApp thread.",
    v: "A new birth, a death, a reunion date — announced once in chat, unsearchable a week later, missed by whoever wasn't online that day.",
  },
  {
    k: "Knowledge lives in one elder's memory, or one notebook.",
    v: "When it's gone, it's gone — nothing was ever shared, recorded together, or backed up.",
  },
];

/** The solution, in exactly four dimensions — a short verb label, a bold
 *  claim, then what it actually means. Order matches the priority a new
 *  user should feel it in. */
const SOLUTION = [
  {
    label: "Link it",
    k: "One person, one record.",
    v: "Before you add anyone, we check if they're already recorded. Found them? You link to that same record instead of retyping it — two families can connect through a marriage without either one duplicating or inheriting the other's data.",
  },
  {
    label: "Map it",
    k: "Real relationships, not just names.",
    v: "Grandparents, in-laws, nieces and nephews — worked out automatically from how people connect, including across a marriage into another family's tree. Ask \"how are we related?\" and get a real answer, not a guess.",
  },
  {
    label: "Build it",
    k: "History you build together.",
    v: "A memory or a prompt reaches the other person, who adds their side. The record grows from both of you, not from whoever got to the keyboard first.",
  },
  {
    label: "Keep it",
    k: "There when it matters most.",
    v: "A memorial page, guestbook and printable eulogy book when someone passes. A welfare fund the family can contribute to. Automatic backups, so none of it is one failure away from gone.",
  },
];

/** A mockup of the actual product — not abstract art — so a visitor can
 *  picture the app they'd be using, the way a real dashboard screenshot
 *  would. Static, illustrative numbers only. */
function ProductMockup() {
  const activity = [
    { who: "Faith", what: "added a childhood memory", when: "Today, 14:20" },
    { who: "Peter", what: "claimed his profile", when: "Yesterday" },
    { who: "Grace", what: "published a memorial", when: "2 days ago" },
  ];
  return (
    <div
      className="relative rounded-2xl border p-5 shadow-lg"
      style={{ borderColor: "var(--border)", background: "var(--elevated)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Good evening, Amina</p>
          <p className="font-serif text-lg text-[var(--fg)]">Otieno Family</p>
        </div>
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ background: "var(--color-brand-600)" }}
        >
          AO
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>People recorded</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--fg)]">142</p>
          <p className="text-xs" style={{ color: "var(--color-brand-700)" }}>+3 this month</p>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Generations connected</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--fg)]">4</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>0 duplicates</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>Recent activity</p>
          <span className="text-xs" style={{ color: "var(--color-brand-700)" }}>View all</span>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {activity.map((a) => (
            <li
              key={a.who + a.when}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: "var(--border)" }}
            >
              <span>
                <strong>{a.who}</strong> {a.what}
              </span>
              <span style={{ color: "var(--muted)" }}>{a.when}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
        Every profile, one shared record.
      </p>
    </div>
  );
}

/**
 * The free family-record story: what the project is for, the problem it solves
 * and who is already using it. Lives on the About page; the landing page is the shop.
 */
export async function FamilyRecordPitch() {
  const user = await getSessionUser();
  const appHref = user ? await homePathForUser(user.id) : null;
  const showcase = await publicShowcase();

  return (
    <div className="flex flex-col">
      {/* Hero — the hook, plus a mockup of the actual product so a visitor
          can picture using it, not just read about it. */}
      <section className="relative mt-8 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
        <PeanutArt variant="hero" className="absolute inset-0 h-full w-full opacity-70" />
        <div className="relative grid gap-10 px-8 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
              A living record of how families are made
            </p>
            <h2 className="mt-3 font-serif text-4xl leading-tight text-[var(--fg)] sm:text-5xl">
              Family is the people you share a history with.
            </h2>
            <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">
              One place for the family you were born into and the family you chose — recorded
              together, and never duplicated when your families meet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={appHref ?? "/start"} className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
                {user ? "Open Family Compass" : "Start free"}
              </Link>
              <Link
                href="/discover"
                className="rounded-lg border px-5 py-3 font-medium text-[var(--fg)] backdrop-blur"
                style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 86%, transparent)" }}
              >
                Explore public trees
              </Link>
            </div>
          </div>
          <ProductMockup />
        </div>
      </section>

      {/* The problem — spelled out, not implied */}
      <section id="problem" className="mx-auto mt-14 max-w-3xl scroll-mt-20 text-center">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          The problem
        </p>
        <h2 className="mt-2 font-serif text-2xl">
          Running a family history by hand doesn&apos;t scale.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px]" style={{ color: "var(--muted)" }}>
          Every family hits the same wall eventually — usually right when it matters most to get
          it right.
        </p>
        <ul className="mx-auto mt-8 grid max-w-2xl gap-x-8 gap-y-6 text-left sm:grid-cols-2">
          {PROBLEMS.map((p) => (
            <li key={p.k}>
              <p className="font-medium">{p.k}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{p.v}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* The solution — four dimensions, no more */}
      <section id="solution" className="mt-16 scroll-mt-20">
        <p className="text-center text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-700)" }}>
          The solution
        </p>
        <h2 className="mx-auto mt-2 max-w-xl text-center font-serif text-2xl">
          Four things a family record actually needs.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px]" style={{ color: "var(--muted)" }}>
          Not a spreadsheet with extra steps — built around how families actually connect.
        </p>
        <ol className="mx-auto mt-10 grid max-w-3xl gap-x-8 gap-y-8 text-left sm:grid-cols-2">
          {SOLUTION.map((s) => (
            <li key={s.label}>
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-brand-700)" }}
              >
                {s.label}
              </span>
              <h3 className="mt-1 font-medium">{s.k}</h3>
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

    </div>
  );
}
