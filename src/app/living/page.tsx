import Link from "next/link";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { productImage } from "@/lib/product-images";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "The Living — family tree posters and books",
  description: "Build your family story: a family tree poster with a QR code that opens your living family page.",
};
export const dynamic = "force-dynamic";

export default async function LivingPage() {
  const products = await db.product.findMany({
    where: { pathway: "LIVING", active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Home
      </Link>
      <h1 className="mt-4 font-serif text-4xl text-[#3b2a1c]">Build your family story.</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#4a3728]">
        Every piece carries a QR code that opens your family page, so relatives can find themselves, join, and add their side.
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
        <p className="font-medium">Already building your tree?</p>
        <p className="mt-1" style={{ color: "var(--muted)" }}>
          Charts and family books are made from your existing tree. <Link href="/login" className="underline">Sign in</Link> to open it.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
