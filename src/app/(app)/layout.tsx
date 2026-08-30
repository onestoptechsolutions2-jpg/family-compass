import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { signOut } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/app" className="font-semibold">
            🧭 Family Compass
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user.isPlatformAdmin && (
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>
            )}
            <Link href="/account" className="hover:underline" style={{ color: "var(--muted)" }}>
              {user.email}
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="rounded-md border px-2.5 py-1" style={{ borderColor: "var(--border)" }}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
