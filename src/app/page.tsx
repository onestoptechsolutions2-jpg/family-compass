import Link from "next/link";

import { getSessionUser } from "@/lib/rbac";

const FEATURES = [
  {
    title: "Build the tree together",
    body: "Add people, families, events, places, sources and photos. Invite relatives with viewer, contributor or editor roles.",
  },
  {
    title: "Explore visually",
    body: "Pan-and-zoom ancestor, descendant and hourglass views. Re-root on anyone with a click. Fan charts too.",
  },
  {
    title: "Import what you have",
    body: "Bring in your existing Gramps (.gramps) database or any GEDCOM file. Nothing to retype.",
  },
  {
    title: "Share from any person",
    body: "Publish a read-only tree centered on a chosen relative. Living people are automatically redacted.",
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
        <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
          Your family history, alive and shared.
        </h1>
        <p className="mt-5 max-w-xl text-lg" style={{ color: "var(--muted)" }}>
          A collaborative home for your family tree. Build it with relatives, explore it
          visually, and generate print-ready pedigree, fan and descendant charts when you need
          them.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href={user ? "/app" : "/login"}
            className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
          >
            {user ? "Go to your trees" : "Start free"}
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border px-5 py-3 font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            See chart pricing
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
        Family Compass — building tools free · print-ready charts KES 750 each.
      </footer>
    </main>
  );
}
