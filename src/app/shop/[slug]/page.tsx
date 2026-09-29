import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { SiteFooter } from "@/components/SiteFooter";

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
        ? "You approve the layout and pay a deposit by M-Pesa. We confirm it, our supplier prints it, and your family page goes live with the QR code on the poster."
        : "You approve the layout and pay a deposit by M-Pesa. We confirm it, our supplier makes it, and their memorial page goes live with the QR code on the piece.",
    },
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 py-10">
      <Link href={back} className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Back
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>{p.group}</p>
      <h1 className="mt-1 font-serif text-4xl text-[#3b2a1c]">{p.name}</h1>
      <p className="mt-2 text-lg font-medium">From {kes(p.basePriceKes)}</p>

      <Link
        href={`/order/new?product=${p.slug}`}
        className="mt-5 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        Start designing
      </Link>

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
