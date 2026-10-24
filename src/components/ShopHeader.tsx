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
      {/* one row on a phone: the name, the shop, the cart; search lives in the shop */}
      <header className="glass-toolbar mb-6 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg border text-xs font-bold" style={{ borderColor: "var(--glass-edge)", color: "var(--accent)" }}>FC</span>
          <span className="hidden sm:inline">Family Compass</span>
        </Link>
        {q !== undefined && (
          <form action="/shop" className="min-w-0 flex-1">
            <input name="q" defaultValue={q} placeholder="Search" aria-label="Search the shop" className="w-full rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
          </form>
        )}
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/shop" className="rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">Shop</Link>
          {user && <Link href="/orders" className="rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">Orders</Link>}
          <Link href="/cart" className="rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">Cart{count > 0 ? ` (${count})` : ""}</Link>
          {!user && <Link href="/login?callbackUrl=%2Fshop" className="rounded-md px-2 py-1.5 font-medium text-[var(--link)] hover:bg-[var(--surface-2)]">Sign in</Link>}
        </nav>
      </header>
      {user && <VerifyBanner userId={user.id} sent={sent} confirmed={confirmed} />}
    </>
  );
}
