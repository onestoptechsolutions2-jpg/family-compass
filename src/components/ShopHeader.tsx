import Link from "next/link";

import { cartCount } from "@/lib/cart";
import { getSessionUser } from "@/lib/rbac";
import { VerifyBanner } from "@/components/VerifyBanner";

/** The shop's top bar: search, orders, cart. Same on every shop page. */
export async function ShopHeader({ q, sent, confirmed }: { q?: string; sent?: boolean; confirmed?: boolean }) {
  const user = await getSessionUser();
  const count = user ? await cartCount(user.id) : 0;
  return (
    <>
      <header
        className="mb-8 grid grid-cols-1 items-center gap-3 border-b pb-4 sm:grid-cols-[auto_auto_minmax(12rem,1fr)_auto]"
        style={{ borderColor: "var(--border)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-md border text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>FC</span>
          <span>Family Compass</span>
        </Link>
        <Link href="/shop" className="rounded-md px-2 py-1.5 text-sm font-medium text-[var(--link)] hover:bg-[var(--surface-2)]">Shop</Link>
        <form action="/shop" className="w-full">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search the shop"
            aria-label="Search the shop"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          />
        </form>
        <nav className="flex items-center gap-3 text-sm sm:justify-self-end">
          {user && <Link href="/orders" className="rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">My orders</Link>}
          <Link href="/cart" className="rounded-md border px-3 py-1.5 font-medium" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            Cart{count > 0 ? ` (${count})` : ""}
          </Link>
          {!user && <Link href="/login?callbackUrl=%2Fshop" className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">Sign in</Link>}
        </nav>
      </header>
      {user && <VerifyBanner userId={user.id} sent={sent} confirmed={confirmed} />}
    </>
  );
}
