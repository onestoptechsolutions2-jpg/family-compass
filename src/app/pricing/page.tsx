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
          <span className="text-4xl font-semibold">KES 750</span>
          <span style={{ color: "var(--muted)" }}>per generated download</span>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Preview any chart for free with a watermark. Pay by M-Pesa to unlock a clean,
          high-resolution copy of that generation.
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
