import Link from "next/link";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { getSessionUser } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { cartTotal, getCart, lineTotal } from "@/lib/cart";
import { renderPrintSheet } from "@/lib/print-sheet";
import type { DraftOptions } from "@/lib/order-shared";
import { isLayout } from "@/lib/layouts";
import { findMatchQuestions } from "@/lib/matching";
import { ShopHeader } from "@/components/ShopHeader";
import { checkoutAction, removeItemAction, setQuantityAction } from "./actions";

export const metadata = { title: "Your cart" };
export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;

export default async function CartPage({ searchParams }: { searchParams: Promise<{ error?: string; added?: string }> }) {
  const { error, added } = await searchParams;
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
        <ShopHeader />
        <h1 className="font-serif text-3xl text-[#3b2a1c]">Your cart</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>Sign in to see your cart. Anything you personalised is kept for you.</p>
        <Link href="/login?callbackUrl=%2Fcart" className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white">Sign in with Google</Link>
      </main>
    );
  }

  const cart = await getCart(user.id);
  const origin = await publicOrigin();
  const items = cart?.items ?? [];
  // Names that look like people already in this customer's family: ask, do not guess.
  const questions = await findMatchQuestions(user.id, items);

  // Delivery details: this basket's, else the last order's, else what we know.
  const last = cart?.contactName
    ? null
    : await db.order.findFirst({ where: { userId: user.id, contactName: { not: null } }, orderBy: { createdAt: "desc" } });
  const prefill = {
    name: cart?.contactName ?? last?.contactName ?? user.name ?? "",
    phone: cart?.contactPhone ?? last?.contactPhone ?? "",
    address: cart?.deliveryText ?? last?.deliveryText ?? "",
  };

  const thumbs = await Promise.all(
    items.map(async (i) => {
      const o = (i.options ?? {}) as DraftOptions;
      const sheet = await renderPrintSheet(
        { options: o, productName: i.product.name, qrUrl: `${origin}/q/yourcode`, pathway: i.product.pathway, layout: isLayout(i.product.layout) ? i.product.layout : "tree" },
        o.sizeKey,
      );
      return sheet.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%"');
    }),
  );

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-6">
      <ShopHeader />
      <h1 className="font-serif text-3xl text-[#3b2a1c]">Your cart</h1>
      {added && <p className="mt-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>Added to your cart.</p>}
      {error && <p className="mt-2 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)" }}>
          <p className="font-medium">Your cart is empty.</p>
          <Link href="/shop" className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 font-medium text-white">Browse the shop</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="flex flex-col gap-4">
            {items.map((i, n) => {
              const o = (i.options ?? {}) as DraftOptions;
              const po = i.product.options as { materials?: { key: string; label: string }[]; sizes?: { key: string; label: string }[] } | null;
              const material = po?.materials?.find((m) => m.key === o.materialKey)?.label;
              const size = po?.sizes?.find((m) => m.key === o.sizeKey)?.label;
              return (
                <article key={i.id} className="flex gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <div className="w-28 shrink-0 overflow-hidden rounded-lg border sm:w-36" style={{ borderColor: "var(--border)" }} dangerouslySetInnerHTML={{ __html: thumbs[n]! }} />
                  <div className="min-w-0 flex-1 text-sm">
                    <h2 className="font-semibold">{i.product.name}</h2>
                    <p style={{ color: "var(--muted)" }}>For {o.title?.trim() || [o.first, o.surname].filter(Boolean).join(" ") || o.surname || "—"}</p>
                    <p style={{ color: "var(--muted)" }}>{[material, size].filter(Boolean).join(" · ")}</p>
                    <p className="mt-2 font-medium">{kes(lineTotal(i))}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <form action={setQuantityAction.bind(null, i.id)} className="flex items-center gap-2">
                        <label className="text-xs" style={{ color: "var(--muted)" }}>Qty</label>
                        <input name="quantity" type="number" min={1} max={20} defaultValue={i.quantity} className="w-16 rounded-lg border px-2 py-1" style={fieldStyle} />
                        <button className="text-xs underline">Update</button>
                      </form>
                      <Link href={`/cart/edit/${i.id}`} className="text-xs underline">Edit</Link>
                      <form action={removeItemAction.bind(null, i.id)}><button className="text-xs underline" style={{ color: "var(--muted)" }}>Remove</button></form>
                    </div>
                  </div>
                </article>
              );
            })}
            <Link href="/shop" className="text-sm underline">Continue shopping</Link>
          </section>

          <form action={checkoutAction} className="flex h-fit flex-col gap-3 rounded-2xl border p-5 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {questions.length > 0 && (
              <fieldset className="flex flex-col gap-4 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                <legend className="px-1 text-base font-semibold">Is this someone already in your family?</legend>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  We found people in your family with the same names. Tell us which is which, so nobody is added twice.
                </p>
                {questions.map((q) => (
                  <div key={`${q.itemId}:${q.key}`} className="flex flex-col gap-1">
                    <p>You typed <strong>{q.typed}</strong> as {q.role}.</p>
                    {q.candidates.map((c) => (
                      <label key={c.id} className="flex items-start gap-2">
                        <input type="radio" required name={`match:${q.itemId}:${q.key}`} value={c.id} className="mt-1" />
                        <span>Yes, it is {c.name}{c.born ? `, born ${c.born}` : ""}{c.you ? " (you)" : ""}</span>
                      </label>
                    ))}
                    <label className="flex items-start gap-2">
                      <input type="radio" required name={`match:${q.itemId}:${q.key}`} value="new" className="mt-1" />
                      <span>No, a different person</span>
                    </label>
                  </div>
                ))}
              </fieldset>
            )}
            <h2 className="text-lg font-semibold">Delivery</h2>
            <label>Your name<input name="contactName" required defaultValue={prefill.name} className={field} style={fieldStyle} /></label>
            <label>Phone (WhatsApp if possible)<input name="contactPhone" required defaultValue={prefill.phone} className={field} style={fieldStyle} /></label>
            <label>Delivery address, or the grave and cemetery
              <textarea name="deliveryText" required rows={3} defaultValue={prefill.address} className={field} style={fieldStyle} />
            </label>
            <div className="mt-2 flex justify-between border-t pt-3 text-base font-semibold" style={{ borderColor: "var(--border)" }}>
              <span>Total</span><span>{kes(cartTotal(items))}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Delivery is included. You pay once by M-Pesa; each item is made and sent as soon as your payment is confirmed.</p>
            <button className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">Place order and pay</button>
          </form>
        </div>
      )}
    </main>
  );
}
