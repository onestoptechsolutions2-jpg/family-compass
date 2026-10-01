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
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
      <Link href="/" className="font-semibold">🧭 Family Compass</Link>
      <Link href="/shop" className="text-sm hover:underline">Shop</Link>
      <form action="/shop" className="order-last w-full sm:order-none sm:ml-2 sm:w-auto sm:flex-1">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search the shop"
          aria-label="Search the shop"
          className="w-full rounded-lg border px-3 py-1.5 text-sm sm:max-w-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        />
      </form>
      <nav className="ml-auto flex items-center gap-4 text-sm">
        {user && <Link href="/orders" className="hover:underline">My orders</Link>}
        <Link href="/cart" className="rounded-lg border px-3 py-1.5 font-medium" style={{ borderColor: "var(--border)" }}>
          Cart{count > 0 ? ` (${count})` : ""}
        </Link>
        {!user && <Link href="/login?callbackUrl=%2Fshop" className="hover:underline">Sign in</Link>}
      </nav>
    </header>
    {user && <VerifyBanner userId={user.id} sent={sent} confirmed={confirmed} />}
    </>
  );
}
