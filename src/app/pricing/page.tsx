import Link from "next/link";

export const metadata = { title: "Pricing" };

const PAID = [
  ["Pedigree / ancestor chart", "Print-ready PDF from your chosen person, several generations up."],
  ["Fan chart", "High-resolution circular fan chart (PNG + PDF)."],
  ["Descendant chart", "Everyone descending from your chosen person."],
  ["Family book", "A multi-page narrative PDF of the whole tree."],
  ["GEDCOM / .gramps export", "A portable data file of your tree."],
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Simple pricing</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>
        Building and sharing your family tree is <strong>free</strong> — unlimited people,
        photos, and relatives. You only pay when you generate a finished chart or export to
        download.
      </p>

      <div
        className="mt-8 rounded-2xl border p-6"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold">from KES 750</span>
          <span style={{ color: "var(--muted)" }}>per generated download</span>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Preview any chart free with a watermark, then pay by M-Pesa for a clean copy. The
          price scales with the document, how many generations it covers, and how many
          people/families are on it — a big reunion book costs more than a one-page pedigree.
        </p>
        <ul className="mt-5 flex flex-col gap-3">
          {PAID.map(([title, body]) => (
            <li key={title}>
              <div className="font-medium">{title}</div>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                {body}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>
          Buying more than one? Bundles bring it down to <strong>KES 500</strong> (5) or{" "}
          <strong>KES 400</strong> (15) per download.
        </p>
      </div>

      <div
        className="mt-4 rounded-2xl border p-6"
        style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold">KES 3,000</span>
          <span style={{ color: "var(--muted)" }}>per family, per year</span>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          <strong>Family plan</strong> — one payment covers a whole year of{" "}
          <strong>unlimited</strong> chart and export downloads for that tree. Best if you&apos;ll
          make more than four in a year (reunions, funerals, milestone birthdays).
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-2xl font-semibold">KES 300</div>
          <div style={{ color: "var(--muted)" }}>per deep search</div>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Check a name / clan across every family in the research directory — e.g. before a
            relationship or marriage. Free preview shows how many matches exist.
          </p>
        </div>
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-2xl font-semibold">Research Partner</div>
          <div style={{ color: "var(--muted)" }}>quoted per project</div>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            We do the research for you — field interviews and archives. Priced by depth
            (generations) and size (people/families). Firm quote first.
          </p>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-8 inline-block rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
      >
        Start your tree
      </Link>
    </main>
  );
}
