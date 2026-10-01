import Link from "next/link";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { productImage } from "@/lib/product-images";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "The Remembered — plaques, memorials and tombstone trees",
  description: "Preserve their story forever: memorial pages, plaques with a QR code, and tombstone family trees.",
};
export const dynamic = "force-dynamic";

export default async function RememberedPage() {
  const products = await db.product.findMany({
    where: { pathway: "REMEMBERED", active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Home
      </Link>
      <h1 className="mt-4 font-serif text-4xl text-[var(--fg)]">Preserve their story forever.</h1>
      <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
        Every plaque carries a QR code that opens their memorial, then their family, so visitors can move
        from the stone to the people and the stories.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/shop/${p.slug}`}
            className="rounded-2xl border p-6 transition hover:shadow-md"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            {productImage(p.slug) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImage(p.slug)!.src} alt={productImage(p.slug)!.alt} className="mb-4 aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />
            )}
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {p.group}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{p.name}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{p.summary}</p>
            <p className="mt-4 text-sm font-medium">From {kes(p.basePriceKes)}</p>
          </Link>
        ))}
        {products.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Products are being added. Check back soon.</p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)" }}>
        <p className="font-medium">Already have a memorial page?</p>
        <p className="mt-1" style={{ color: "var(--muted)" }}>
          Memorial pages, funeral programmes and memorial books are available from your family&apos;s
          memorial. <Link href="/login" className="underline">Sign in</Link> to open it.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
