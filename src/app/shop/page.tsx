import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { AISLES, aisleLabel } from "@/lib/aisles";
import { cardPhoto, photosFor } from "@/lib/product-photos";
import { priceRange, type ProductOptions } from "@/lib/product-pricing";
import { ShopHeader } from "@/components/ShopHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Shop: family trees, memorials and keepsakes", description: "Personalised family trees, plaques and keepsakes made from your family's story, delivered to your door." };
export const dynamic = "force-dynamic";

const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  featured: { sortOrder: "asc" },
  price_asc: { basePriceKes: "asc" },
  price_desc: { basePriceKes: "desc" },
  name: { name: "asc" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ aisle?: string; q?: string; sort?: string; sent?: string; confirmed?: string }>;
}) {
  const { aisle = "", q = "", sort = "featured", sent, confirmed } = await searchParams;
  const term = q.trim().slice(0, 80);
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(AISLES.some((a) => a.key === aisle) ? { aisle } : {}),
    ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { summary: { contains: term, mode: "insensitive" } }] } : {}),
  };
  const [products, counts] = await Promise.all([
    db.product.findMany({ where, orderBy: SORTS[sort] ?? SORTS.featured }),
    db.product.groupBy({ by: ["aisle"], where: { active: true }, _count: true }),
  ]);
  const shown = await photosFor(products);
  const total = counts.reduce((n, c) => n + c._count, 0);
  const countOf = (k: string) => counts.find((c) => c.aisle === k)?._count ?? 0;

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(aisle ? { aisle } : {}), ...(term ? { q: term } : {}), ...(sort !== "featured" ? { sort } : {}), ...over });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm ${active ? "border-brand-600 bg-brand-50 font-medium" : ""}`;

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <ShopHeader q={term} sent={sent === "1"} confirmed={confirmed === "1"} />
      <h1 className="font-serif text-3xl text-[var(--fg)]">Shop</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Everything is made for your family, from the names and dates you give us. Delivery is included in every price.
      </p>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Aisles">
        <Link href={href({ aisle: "" })} className={chip(!aisle)} style={aisle ? { borderColor: "var(--border)" } : undefined}>All ({total})</Link>
        {AISLES.map((a) => (
          <Link key={a.key} href={href({ aisle: a.key })} className={chip(aisle === a.key)} style={aisle === a.key ? undefined : { borderColor: "var(--border)" }}>
            {a.label} ({countOf(a.key)})
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span style={{ color: "var(--muted)" }}>
          {products.length} product{products.length === 1 ? "" : "s"}{term ? ` for "${term}"` : ""}
        </span>
        <span className="flex gap-3">
          {(["featured", "price_asc", "price_desc"] as const).map((s) => (
            <Link key={s} href={href({ sort: s === "featured" ? "" : s })} className={sort === s ? "font-medium underline" : "hover:underline"}>
              {{ featured: "Featured", price_asc: "Price: low to high", price_desc: "Price: high to low" }[s]}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const img = cardPhoto(shown.get(p.id)!, p.slug);
          const range = priceRange(p.basePriceKes, (p.options ?? null) as ProductOptions | null, p.layout);
          return (
            <Link key={p.id} href={`/shop/${p.slug}`} className="overflow-hidden rounded-2xl border transition hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} width={640} height={480} className="aspect-[4/3] w-full object-cover" style={{ background: "var(--color-surface-2)" }} loading="lazy" />
              <div className="p-4">
                <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{aisleLabel(p.aisle) || p.group}</p>
                <h2 className="mt-1 font-semibold">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--muted)" }}>{p.summary}</p>
                <p className="mt-3 font-medium">{range.to > range.from ? "From " : ""}{kes(range.from)} <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>delivery included</span></p>
              </div>
            </Link>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="mt-8 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)" }}>
          <p className="font-medium">{term ? "Nothing matches your search." : "This aisle is being stocked."}</p>
          <p className="mt-1" style={{ color: "var(--muted)" }}>
            {term ? "Try a shorter word, or " : "New products arrive soon. "}
            <Link href="/shop" className="underline">see everything</Link>.
          </p>
        </div>
      )}
      <SiteFooter />
    </main>
  );
}
