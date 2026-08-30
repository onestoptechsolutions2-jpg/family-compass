import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { signOut } from "@/lib/auth";
import { userConsentState } from "@/lib/consent";
import { unreadNotificationCount } from "@/lib/notify";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const consent = await userConsentState(user.id);
  if (consent.stale) redirect("/consent");
  const unread = await unreadNotificationCount(user.id);

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
            <Link href="/communities" className="hover:underline">
              Communities
            </Link>
            <Link href="/discover" className="hover:underline">
              Discover
            </Link>
            <Link href="/research" className="hover:underline">
              Research
            </Link>
            <Link href="/developers" className="hover:underline">
              Developers
            </Link>
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
