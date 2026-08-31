import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { signOut } from "@/lib/auth";
import { userConsentState } from "@/lib/consent";
import { unreadNotificationCount } from "@/lib/notify";
import { readFlash } from "@/lib/flash";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/Toaster";
import { InstallReporter } from "@/components/InstallReporter";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const consent = await userConsentState(user.id);
  if (consent.stale) redirect("/consent");
  const unread = await unreadNotificationCount(user.id);
  const flash = await readFlash();

  const doSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

  return (
    <div className="min-h-dvh">
      <Toaster flash={flash} />
      <InstallReporter />
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/app" className="shrink-0 font-semibold">
            🧭 <span className="hidden sm:inline">Family </span>Compass
          </Link>

          <div className="flex items-center gap-3">
            <CommandPalette />
            <Link href="/notifications" className="relative hover:underline" title="Notifications">
              🔔
              {unread > 0 && (
                <span
                  className="absolute -right-2 -top-1 rounded-full px-1 text-[10px] font-semibold text-white"
                  style={{ background: "var(--color-brand-600)" }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* desktop */}
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link href="/guide" className="hover:underline">Guide</Link>
              <Link href="/communities" className="hover:underline">Communities</Link>
              <Link href="/discover" className="hover:underline">Discover</Link>
              <Link href="/research" className="hover:underline">Research</Link>
              <Link href="/developers" className="hover:underline">Developers</Link>
              {user.isPlatformAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
              <Link href="/account" className="hover:underline" style={{ color: "var(--muted)" }}>
                {user.email}
              </Link>
              <form action={doSignOut}>
                <button className="rounded-md border px-2.5 py-1" style={{ borderColor: "var(--border)" }}>
                  Sign out
                </button>
              </form>
            </nav>

            {/* mobile */}
            <details className="relative md:hidden">
              <summary
                className="flex cursor-pointer list-none items-center rounded-md border px-2.5 py-1 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                ☰
              </summary>
              <div
                className="absolute right-0 z-20 mt-2 w-56 rounded-xl border p-2 text-sm shadow-lg"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <Link href="/app?trees=1" className="block rounded-md px-2 py-2 hover:bg-black/5">Your trees</Link>
                <Link href="/guide" className="block rounded-md px-2 py-2 hover:bg-black/5">Guide</Link>
                <Link href="/communities" className="block rounded-md px-2 py-2 hover:bg-black/5">Communities</Link>
                <Link href="/discover" className="block rounded-md px-2 py-2 hover:bg-black/5">Discover</Link>
                <Link href="/research" className="block rounded-md px-2 py-2 hover:bg-black/5">Research</Link>
                <Link href="/developers" className="block rounded-md px-2 py-2 hover:bg-black/5">Developers</Link>
                {user.isPlatformAdmin && (
                  <Link href="/admin" className="block rounded-md px-2 py-2 hover:bg-black/5">Admin</Link>
                )}
                <Link href="/account" className="block rounded-md px-2 py-2 hover:bg-black/5">Account</Link>
                <div className="truncate px-2 py-1 text-xs" style={{ color: "var(--muted)" }}>{user.email}</div>
                <form action={doSignOut} className="px-2 pt-1">
                  <button className="w-full rounded-md border px-2.5 py-1.5 text-left" style={{ borderColor: "var(--border)" }}>
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
