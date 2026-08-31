import Link from "next/link";

import { getSessionUser } from "@/lib/rbac";
import { PeanutArt } from "@/components/GradientArt";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata = {
  title: "Family Compass — the family you come from and the family you choose",
  description:
    "A relationship is the history two people share. Record yours together — memory by memory, conversation by conversation — across the family you were born into and the family you built. A consent-first Kenyan genealogy & research project.",
};

/** The thesis the whole product is built on. */
const BASIS = [
  {
    k: "A shared history, not a line",
    v: "A relationship is the record of what two people have lived through together. We keep the memories and the conversations; the connection is what they add up to.",
  },
  {
    k: "Built by both people",
    v: "No one owns a relationship. Everyone in a memory can add their side of it — even when they remember it differently.",
  },
  {
    k: "It grows, and it changes",
    v: "Ties thicken, fade, break and heal. Every connection has a timeline you can see — not a fixed label or a score you typed in.",
  },
  {
    k: "The family you choose counts",
    v: "Friends, mentors, the aunty who isn't blood. Start your own tree, centred on you, and invite the people who matter — related or not.",
  },
];

const VALUES = [
  { k: "Consent first", v: "Sharing, the research directory, and showing living people are each off until you switch them on. Living and private records are always redacted." },
  { k: "Family-owned", v: "You keep ownership of everything you add. Export to GEDCOM or .gramps, or delete, at any time." },
  { k: "Memory by memory", v: "You don't rate your relationships. You add a memory or answer a question about someone; closeness is read from the record, with its evidence shown." },
  { k: "African by design", v: "Clans, sub-clans, totems and county-to-village places are first-class — not an afterthought bolted onto a Western model." },
];

const FEATURES = [
  { title: "Record the bond together", body: "Add a memory, answer a prompt, tell the story of how you met. Each contribution reaches the other person, who adds their side — and the connection between you thickens." },
  { title: "Invite your own people", body: "Anyone can start a tree centred on themselves and invite friends as well as relatives. Trees link where lives overlap, into one honest picture of how we're connected." },
  { title: "Are we related?", body: "Check two people for a shared bloodline or clan before a relationship. Paid deep search extends the check across other families that opted in." },
  { title: "Memorials & eulogy books", body: "When someone passes, open a memorial page: a tribute, an auditable funeral programme, a guestbook, and a printable eulogy book." },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">🧭 Family Compass</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/docs" className="hover:underline">Developers</Link>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          {user ? (
            <Link href="/app" className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
              Open app
            </Link>
          ) : (
            <Link href="/login" className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
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
            Record that history together — the family you come from and the family you choose —
            one memory, one conversation at a time. A consent-first Kenyan research project,
            starting in Western Kenya.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/app" : "/start"} className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
              {user ? "Go to your trees" : "Start free"}
            </Link>
            <Link href="/about" className="rounded-lg border border-[#00000022] bg-white/70 px-5 py-3 font-medium text-[#3b2a1c] backdrop-blur">
              About the project
            </Link>
          </div>
        </div>
      </section>

      {/* The idea */}
      <section className="mt-14">
        <h2 className="font-serif text-2xl">What a relationship actually is</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
          We&apos;re studying one question: when is the family you make more important than the
          family you come from? To answer it honestly, we treat a relationship the way it really
          works — something two people build over time.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {BASIS.map((x) => (
            <div key={x.k} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="font-medium">{x.k}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{x.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="mt-14 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-center gap-3">
            <PeanutArt variant="badge" className="h-10 w-10" seed="vision" />
            <h2 className="font-serif text-xl">Our vision</h2>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
            A Kenya where every family — the one you&apos;re born into and the one you build — can
            hold its own history: the clans and lineages, and the memories and conversations that
            actually bind people. Shared only with consent, it becomes an honest, community-owned
            picture of how we are all connected.
          </p>
        </div>
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-center gap-3">
            <PeanutArt variant="badge" className="h-10 w-10" seed="mission" />
            <h2 className="font-serif text-xl">Our mission</h2>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Give people a simple, respectful way to record their relationships together — memory by
            memory — settle the questions that matter (<em>are we related?</em>, who are our people,
            where did we come from) and preserve the knowledge that is fading with our elders.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl">What we stand for</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((x) => (
            <div key={x.k} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="font-medium">{x.k}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{x.v}</p>
            </div>
          ))}
        </div>
      </section>

      <PeanutArt variant="strip" className="my-12 h-1.5 w-full rounded-full" />

      {/* Features */}
      <section className="grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-16 border-t pt-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        Building &amp; sharing free · print charts, deep search &amp; commissioned research paid ·{" "}
        <Link href="/policies" className="hover:underline">Policies</Link> ·{" "}
        <Link href="/docs" className="hover:underline">API &amp; webhooks</Link>
      </footer>

      <InstallPrompt />
    </main>
  );
}
