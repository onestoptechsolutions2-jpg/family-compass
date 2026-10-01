import Link from "next/link";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { publicOrigin } from "@/lib/origin";
import { cardPhoto, photosFor } from "@/lib/product-photos";
import { priceRange, type ProductOptions } from "@/lib/product-pricing";
import { ShopHeader } from "@/components/ShopHeader";
import { SiteFooter } from "@/components/SiteFooter";

const TITLE = "Family Compass: family trees, memorial plaques and keepsakes made from your family's story";
const DESCRIPTION =
  "Personalised family trees, memorial plaques, calendars and more, made from the names and dates you give us and delivered to your door. Pay by M-Pesa.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: "Family Compass: keepsakes made from your family's story",
    description: DESCRIPTION,
    type: "website",
    siteName: "Family Compass",
    images: [{ url: "/samples/granite-tombstone-tree-deceased-focus.jpg", width: 1400, height: 1400, alt: "A family tree engraved on stone, with a QR code" }],
  },
  twitter: { card: "summary_large_image", title: "Family Compass: keepsakes made from your family's story", description: DESCRIPTION },
};
export const dynamic = "force-dynamic";

const WHATSAPP = "254113352048";

const DOORS = [
  { pathway: "REMEMBERED" as const, id: "remember", title: "Remembering someone", line: "Preserve their story forever." },
  { pathway: "LIVING" as const, id: "celebrate", title: "Celebrating your family", line: "Build your family story." },
];

const STEPS = [
  ["Choose and personalise", "Pick a piece, type the names and dates, and watch it take shape as you go."],
  ["Pay by M-Pesa", "One payment for everything in your cart. Delivery is included in every price."],
  ["We make it", "Skilled makers in Kenya produce it. We check a photo, and scan the QR, before it ships."],
  ["It arrives", "Delivered to your door, with a QR code that opens your family's page."],
] as const;

const TRUST = [
  ["Delivery included", "The price you see is the price you pay."],
  ["Pay by M-Pesa", "No card needed. We confirm your payment before anything is made."],
  ["Checked before it ships", "Every piece is photographed and its QR scanned first."],
  ["Your family stays yours", "You choose what is shared. Delete it any time."],
] as const;

export default async function LandingPage() {
  const origin = await publicOrigin();
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  // an uploaded photo, else our own, else a generic picture of the piece
  const shown = await photosFor(products);
  const withArt = products.map((p) => ({ p, photo: cardPhoto(shown.get(p.id)!, p.slug) }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Family Compass", url: origin, description: DESCRIPTION },
      {
        "@type": "ItemList",
        itemListElement: products.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: p.name,
            description: p.summary,
            url: `${origin}/shop/${p.slug}`,
            offers: { "@type": "Offer", priceCurrency: "KES", price: p.basePriceKes, availability: "https://schema.org/InStock" },
          },
        })),
      },
    ],
  };

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ShopHeader />

      {/* One promise, then straight to the pieces. */}
      <section className="pb-2 pt-2">
        <h1 className="max-w-3xl font-serif text-3xl leading-tight text-[#3b2a1c] sm:text-5xl">
          Keepsakes made from your family&apos;s story.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[#4a3728] sm:text-lg">
          Family trees, memorial plaques and more, made from the names and dates you give us and delivered to your door.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a href="#shop" className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">See what we make</a>
          <a href="#how" className="rounded-md border px-5 py-2.5 font-medium" style={{ borderColor: "var(--border)" }}>How it works</a>
        </div>
      </section>

      <div id="shop" className="scroll-mt-4" />
      {withArt.length === 0 && (
        <div className="mt-8 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)" }}>
          <p className="font-medium">Our shop is opening soon.</p>
          <p className="mt-1" style={{ color: "var(--muted)" }}>Ask us anything on WhatsApp and we will help you plan your piece.</p>
        </div>
      )}
      {DOORS.map((door) => {
        const rows = withArt.filter((r) => r.p.pathway === door.pathway);
        if (!rows.length) return null;
        return (
          <section key={door.id} id={door.id} className="mt-8 scroll-mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-serif text-2xl text-[#3b2a1c]">{door.title}</h2>
                <p className="text-sm" style={{ color: "var(--muted)" }}>{door.line}</p>
              </div>
              <Link href="/shop" className="text-sm underline">See the whole shop</Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ p, photo }) => {
                const po = (p.options ?? null) as ProductOptions | null;
                const range = priceRange(p.basePriceKes, po, p.layout);
                return (
                  <Link
                    key={p.id}
                    href={`/shop/${p.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border transition hover:shadow-md"
                    style={{ borderColor: "var(--border)", background: "var(--card)" }}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        width={640}
                        height={480}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--muted)" }}>{p.summary}</p>
                      <p className="mt-3 font-medium">
                        {range.to > range.from ? "From " : ""}{kes(range.from)}{" "}
                        <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>delivery included</span>
                      </p>
                      <span className="mt-3 inline-block self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white group-hover:bg-brand-700">
                        Personalise
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <section id="how" className="mt-14 scroll-mt-4">
        <h2 className="font-serif text-2xl text-[#3b2a1c]">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Why you can trust us">
        {TRUST.map(([t, d]) => (
          <div key={t} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)" }}>
            <p className="font-medium">{t}</p>
            <p className="mt-1" style={{ color: "var(--muted)" }}>{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 grid items-center gap-6 rounded-3xl border p-6 sm:p-8 lg:grid-cols-[1fr_1fr]" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div>
          <h2 className="font-serif text-2xl text-[#3b2a1c]">Every piece opens a living family page.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#4a3728]">
            Scan the QR code on a plaque, a tree or a calendar and you land on the family&apos;s own page: their names, their
            stories, the memories relatives add over the years. The piece is the beginning. The family page keeps growing.
          </p>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>You decide what is shared, and you can change it at any time.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/sample/landing-qr" alt="Example of a family tree with a QR code" width={720} height={720} loading="lazy" className="mx-auto w-full max-w-sm rounded-2xl border" style={{ borderColor: "var(--border)" }} />
      </section>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="font-medium">Funeral home, church or workshop?</p>
          <p style={{ color: "var(--muted)" }}>Order for the families you serve, or apply to make our pieces.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/partner/apply" className="rounded-md border px-4 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Become a partner</Link>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hello, I have a question about Family Compass.")}`}
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Ask us on WhatsApp
          </a>
        </div>
      </section>

      <SiteFooter
        links={
          <>
            <Link href="/about" className="hover:underline">About</Link> ·{" "}
            <Link href="/policies" className="hover:underline">Policies</Link> ·{" "}
            <Link href="/discover" className="hover:underline">Find a family</Link> ·{" "}
            <Link href="/partner/apply" className="hover:underline">Become a partner</Link>
          </>
        }
      />
    </main>
  );
}
