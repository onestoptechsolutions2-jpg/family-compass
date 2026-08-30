import Link from "next/link";

import { getSessionUser } from "@/lib/rbac";
import { PeanutArt } from "@/components/GradientArt";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata = {
  title: "Family Compass — Kenyan family history, recorded by the families",
  description:
    "Build your family tree with relatives, record clans and communities, check bloodlines before a marriage, and honour those you've lost. A consent-first Kenyan genealogy & research project.",
};

const VALUES = [
  { k: "Consent first", v: "Sharing, the research directory, and showing living people are each off until you switch them on. Living and private records are always redacted." },
  { k: "Family-owned", v: "You keep ownership of everything you add. Export to GEDCOM or .gramps, or delete, at any time." },
  { k: "Built as you go", v: "Start from one person. Add parents, partners and children inline. The tree grows with the conversation." },
  { k: "African by design", v: "Clans, sub-clans, totems and county-to-village places are first-class — not an afterthought bolted onto a Western model." },
];

const FEATURES = [
  { title: "Build the record together", body: "People, families, events, places, clans and photos — added by the relatives who know. Invite with viewer, contributor or editor roles." },
  { title: "Are we related?", body: "Check two people for a shared bloodline or clan before a relationship. Paid deep search extends the check across other families that opted in." },
  { title: "Memorials & eulogy books", body: "When someone passes, open a memorial page: a tribute, an auditable funeral programme, a guestbook, and a printable eulogy book." },
  { title: "Integrate anything", body: "A REST API and signed webhooks let other apps read your tree and react to events. See the developer docs." },
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
            A community genealogy &amp; research project
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-[#3b2a1c] sm:text-5xl">
            Kenyan family history, recorded by the families themselves.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#4a3728]">
            Build your tree with relatives, record clans and communities, check bloodlines before
            a marriage, and honour those you&apos;ve lost — starting in Western Kenya.
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

      {/* Vision & Mission */}
      <section className="mt-14 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-center gap-3">
            <PeanutArt variant="badge" className="h-10 w-10" seed="vision" />
            <h2 className="font-serif text-xl">Our vision</h2>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
            A Kenya where every family can trace and hold its own history — clan, lineage and
            place — and where that knowledge, shared only with consent, becomes an honest,
            community-owned picture of how we are all connected.
          </p>
        </div>
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-center gap-3">
            <PeanutArt variant="badge" className="h-10 w-10" seed="mission" />
            <h2 className="font-serif text-xl">Our mission</h2>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Give families a simple, respectful tool to record their people together, settle the
            questions that matter — <em>are we related?</em>, who are our people, where did we come
            from — and preserve the lineage knowledge that is fading with our elders.
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
