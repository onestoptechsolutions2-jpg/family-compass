import Link from "next/link";

import { getSessionUser } from "@/lib/rbac";

const FEATURES = [
  {
    title: "Build the family record together",
    body: "People, families, events, places, clans and photos — added by the relatives who know. Invite with viewer, contributor or editor roles.",
  },
  {
    title: "Clans & communities",
    body: "Record clan and sub-clan alongside each person. Browse a community-curated reference for Luhya, Luo, Kikuyu, Kamba and Kalenjin, starting with Western Kenya.",
  },
  {
    title: "Are we related?",
    body: "Check two people for a shared bloodline or clan before a relationship or marriage. Deep search extends the check across other families that opted in.",
  },
  {
    title: "Consent-first",
    body: "You own what you add. Sharing and the research directory are off until you switch them on. Living people are redacted. Export or delete any time.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">🧭 Family Compass</span>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <Link
              href="/app"
              className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
              <Link
                href="/login"
                className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
              >
                Sign in
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--color-brand-600)" }}>
          A community genealogy &amp; research project
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
          Kenyan family history, recorded by the families themselves.
        </h1>
        <p className="mt-5 max-w-xl text-lg" style={{ color: "var(--muted)" }}>
          Build your tree with relatives, record clans and communities, check bloodlines before
          a marriage, and — only if you choose — help build an open picture of how families
          connect. Starting in Western Kenya.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={user ? "/app" : "/login"}
            className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
          >
            {user ? "Go to your trees" : "Start free"}
          </Link>
          <Link
            href="/about"
            className="rounded-lg border px-5 py-3 font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            About the project
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border px-5 py-3 font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Pricing
          </Link>
        </div>
      </section>

      <section className="grid gap-5 pb-16 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {f.body}
            </p>
          </div>
        ))}
      </section>

      <footer className="border-t pt-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        Building &amp; sharing free · print charts, deep search &amp; commissioned research paid ·{" "}
        <Link href="/policies" className="hover:underline">
          Policies
        </Link>
      </footer>
    </main>
  );
}
