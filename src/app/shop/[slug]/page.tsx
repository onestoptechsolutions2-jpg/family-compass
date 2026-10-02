import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { photosFor } from "@/lib/product-photos";
import { SiteFooter } from "@/components/SiteFooter";
import { ShopHeader } from "@/components/ShopHeader";
import { ContinueDraft } from "@/components/ContinueDraft";
import { aisleLabel } from "@/lib/aisles";
import { ProductGallery } from "@/components/ProductGallery";
import { isLayout } from "@/lib/layouts";
import { priceRange, type ProductOptions } from "@/lib/product-pricing";
import { cardPhoto } from "@/lib/product-photos";
import { getSessionUser } from "@/lib/rbac";
import { savedOrderSources } from "@/lib/order-sources";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug }, select: { name: true, summary: true } });
  return { title: p?.name ?? "Product", description: p?.summary };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug } });
  if (!p || !p.active) notFound();

  const po = (p.options ?? null) as ProductOptions | null;
  const photos = (await photosFor([p], true)).get(p.id)!;
  const layout = isLayout(p.layout) ? p.layout : "tree";
  const user = await getSessionUser();
  const saved = user ? await savedOrderSources(user.id) : null;
  const canChooseFamilyMember = p.pathway === "REMEMBERED" || layout === "wedding";
  const savedPeople = (saved?.people ?? []).filter((person) => canChooseFamilyMember || person.id === saved?.customerPersonId);
  const relatedProducts = await db.product.findMany({
    where: { active: true, pathway: p.pathway, id: { not: p.id } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 3,
    select: { id: true, slug: true, name: true, summary: true, basePriceKes: true, options: true, layout: true, updatedAt: true },
  });
  const relatedPhotos = await photosFor(relatedProducts);
  const living = p.pathway === "LIVING";
  const back = living ? "/living" : "/remembered";
  const answers = [
    { q: "What is this?", a: p.summary },
    {
      q: "What do I need to provide?",
      a: living
        ? "Your name, and who to show: parents, spouse, children and brothers and sisters. Add more later, and relatives can add their own side."
        : "Their name and dates, a photo, a short epitaph, and who to show: parents, spouse, children and siblings. Add more later.",
    },
    {
      q: "What happens after I order?",
      a: living
        ? "You approve the layout and pay in full by M-Pesa. We confirm it, our supplier prints it, and your family page goes live with the QR code on the poster."
        : "You approve the layout and pay in full by M-Pesa. We confirm it, our supplier makes it, and their memorial page goes live with the QR code on the piece.",
    },
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <ShopHeader />
      <Link href={p.aisle ? `/shop?aisle=${p.aisle}` : back} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← {aisleLabel(p.aisle) || "Shop"}
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>{p.group}</p>
      <ProductGallery
        slug={p.slug}
        name={p.name}
        description={p.summary}
        basePriceKes={p.basePriceKes}
        options={po ?? {}}
        layout={layout}
        photos={photos}
        savedPeople={savedPeople}
        defaultSavedPersonId={saved?.customerPersonId}
      />
      <ContinueDraft slug={p.slug} />

      <div className="mt-8 flex flex-col gap-4">
        {answers.map((x) => (
          <section key={x.q} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="font-semibold">{x.q}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{x.a}</p>
          </section>
        ))}
      </div>
      {relatedProducts.length > 0 && (
        <section className="mt-12 border-t pt-8" style={{ borderColor: "var(--border)" }} aria-label="Other products for this family data">
          <h2 className="font-serif text-2xl">More ways to use this family story</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Choose another product and reuse your saved family details.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {relatedProducts.map((related) => {
              const relatedOptions = (related.options ?? null) as ProductOptions | null;
              const relatedPrice = priceRange(related.basePriceKes, relatedOptions, related.layout);
              const image = cardPhoto(relatedPhotos.get(related.id) ?? [], related.slug);
              return (
                <Link key={related.id} href={`/shop/${related.slug}`} className="group overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.alt} width={480} height={360} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  <span className="block p-3">
                    <span className="block font-medium group-hover:text-[var(--link)]">{related.name}</span>
                    <span className="mt-1 block text-sm" style={{ color: "var(--muted)" }}>From {kes(relatedPrice.from)} · delivery included</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      <SiteFooter />
    </main>
  );
}
