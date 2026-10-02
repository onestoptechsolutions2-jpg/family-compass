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
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineSupport } from "@/components/OfflineSupport";
import { SiteFooter } from "@/components/SiteFooter";

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
      <InstallPrompt />
      <OfflineSupport />
      <header
        className="glass-toolbar sticky top-0 z-10 border-b"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/app" className="flex shrink-0 items-center gap-2.5 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md border text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>FC</span>
            <span><span className="hidden sm:inline">Family </span>Compass</span>
          </Link>

          <div className="flex items-center gap-3">
            <CommandPalette />
              <Link href="/notifications" className="relative rounded-md border px-2 py-1 hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }} title="Notifications">
              <span aria-hidden>◎</span><span className="sr-only">Notifications</span>
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
                className="glass-menu absolute right-0 z-20 mt-2 w-56 rounded-xl border p-2 text-sm"
                style={{ borderColor: "var(--glass-edge)" }}
              >
                <Link href="/app?trees=1" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Your trees</Link>
                <Link href="/guide" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Guide</Link>
                <Link href="/communities" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Communities</Link>
                <Link href="/discover" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Discover</Link>
                <Link href="/research" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Research</Link>
                <Link href="/developers" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Developers</Link>
                {user.isPlatformAdmin && (
                  <Link href="/admin" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Admin</Link>
                )}
                <Link href="/account" className="block rounded-md px-2 py-2 hover:bg-[var(--surface-2)]">Account</Link>
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
      <div className="mx-auto max-w-6xl px-6 pb-8">
        <SiteFooter />
      </div>
    </div>
  );
}
