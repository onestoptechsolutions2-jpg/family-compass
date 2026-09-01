import Link from "next/link";

export const metadata = { title: "About the project" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-lg font-semibold">
        🧭 Family Compass
      </Link>

      <h1 className="mt-8 font-serif text-3xl">About the project</h1>

      <div className="mt-6 flex flex-col gap-4 text-[15px] leading-relaxed">
        <p>
          Family Compass is a community genealogy and family-history research project for
          Kenyan families. It begins in Western Kenya — Luhya, Luo and neighbouring communities
          — and grows outward as families join.
        </p>
        <p>
          Two things happen here. First, families record their own history: people, marriages,
          clans and sub-clans, the villages they came from, photos and stories — added and
          corrected by the relatives who actually know. Second, with explicit consent, the
          project studies <strong>aggregated, de-identified patterns</strong> across those
          records: how clans spread across wards, how names and family sizes change over
          generations, how separate family trees connect.
        </p>
        <p>
          A relationship here is not a line between two names — it is the history two people
          share, built over time through memories and conversations. Alongside the family you
          are born into, you can record the family you <em>choose</em> — friends, mentors, the
          aunty who isn&apos;t blood — and how each of those ties came to be (through a parent,
          a sibling, school, work, church). The question the research turns on:{" "}
          <em>when is the family you make more important than the family you come from?</em>
        </p>

        <h2 className="mt-4 text-lg font-semibold">What we hold, and what we don&apos;t</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>You keep ownership and control of everything you contribute.</li>
          <li>Sharing a tree, listing it in the research directory, and showing living people are each <strong>off by default</strong> and controlled per tree.</li>
          <li>Living and private records are excluded from research and from public directory detail.</li>
          <li>Research datasets drop names, exact dates, photos and contact details.</li>
          <li>You can export (GEDCOM / .gramps) or delete your data at any time, and withdraw research consent at any time.</li>
        </ul>

        <h2 className="mt-4 text-lg font-semibold">Why it matters</h2>
        <p>
          Clan and lineage knowledge is fading with the elders who hold it. A shared, consented
          record helps families settle questions that matter — <em>are we related?</em> before
          a marriage; who our people are; where we came from — and gives researchers and
          communities an honest, ethically-sourced picture of Kenyan kinship.
        </p>

        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Read the{" "}
          <Link href="/policies/terms" className="text-brand-600 hover:underline">Terms</Link>,{" "}
          <Link href="/policies/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>{" "}
          and{" "}
          <Link href="/policies/research" className="text-brand-600 hover:underline">Research &amp; Ethics policy</Link>.
        </p>
      </div>
    </main>
  );
}
