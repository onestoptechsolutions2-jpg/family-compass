"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type Tab = { href: string; label: string };

export function NavTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    // longest-match wins so "/trees/x" doesn't stay active on "/trees/x/people"
    const matches = tabs
      .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
      .sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href === href;
  };
  const current = tabs.find((t) => isActive(t.href)) ?? tabs[0];

  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      {/* mobile: jump menu */}
      <div className="sm:hidden">
        <label className="sr-only" htmlFor="nav-jump">Section</label>
        <select
          id="nav-jump"
          value={current?.href ?? ""}
          onChange={(e) => router.push(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {tabs.map((t) => (
            <option key={t.href} value={t.href}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* desktop: scrollable strip */}
      <nav
        className="hidden gap-1 overflow-x-auto pb-px text-sm sm:flex"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="shrink-0 whitespace-nowrap rounded-t-md px-3 py-2"
              style={{
                borderBottom: active ? "2px solid var(--color-brand-600)" : "2px solid transparent",
                color: active ? "var(--fg)" : "var(--muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
