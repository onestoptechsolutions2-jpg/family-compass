import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { photosFor } from "@/lib/product-photos";
import { SiteFooter } from "@/components/SiteFooter";
import { ShopHeader } from "@/components/ShopHeader";
import { ContinueDraft } from "@/components/ContinueDraft";
import { aisleLabel } from "@/lib/aisles";
import { priceRange, VARIANT_GROUPS, type ProductOptions } from "@/lib/product-pricing";

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
  const range = priceRange(p.basePriceKes, po, p.layout);
  const photos = (await photosFor([p])).get(p.id)!;
  const drawn = photos.every((x) => x.src.startsWith("/api/sample/"));
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
      <h1 className="mt-1 font-serif text-4xl text-[#3b2a1c]">{p.name}</h1>
      <p className="mt-2 text-lg font-medium">{range.to > range.from ? "From " : ""}{kes(range.from)} <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>· delivery included</span></p>

      <Link
        href={`/order/new?product=${p.slug}`}
        className="mt-5 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        Personalise and add to cart
      </Link>
      <ContinueDraft slug={p.slug} />

      <div className="mt-6 flex flex-col gap-3">
        {photos.map((im) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={im.src} src={im.src} alt={im.alt} width={1200} height={900} className="w-full rounded-2xl border" style={{ borderColor: "var(--border)" }} loading="lazy" />
        ))}
        <p className="text-xs" style={{ color: "var(--muted)" }}>{drawn ? "An illustration, drawn with a sample family." : "Sample of the finished product."} Yours carries your family.</p>
      </div>

      {po && VARIANT_GROUPS.some((g) => (po[g.list]?.length ?? 0) > 1) && (
        <section className="mt-8 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h2 className="font-semibold">Choose how yours is made</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {VARIANT_GROUPS.map((g) => {
              const list = po[g.list] ?? [];
              if (list.length < 2) return null;
              return (
                <div key={g.key}>
                  <p className="text-sm font-medium">{g.title}</p>
                  <ul className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    {list.map((c) => <li key={c.key}>{c.label}{c.addKes ? ` (+${kes(c.addKes)})` : ""}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
          {po.generations && (
            <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
              The price includes {po.generations.included} generations of family. Each extra generation adds {kes(po.generations.perExtraKes)}. You see the total as you build.
            </p>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {answers.map((x) => (
          <section key={x.q} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="font-semibold">{x.q}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{x.a}</p>
          </section>
        ))}
      </div>
      <SiteFooter />
    </main>
  );
}
