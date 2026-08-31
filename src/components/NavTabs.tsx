"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type Tab = { href: string; label: string };
export type NavGroup = { label: string; tabs: Tab[] };
export type NavItem = Tab | NavGroup;

const isGroup = (i: NavItem): i is NavGroup => "tabs" in i;

export function NavTabs({ tabs }: { tabs: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const flat: Tab[] = tabs.flatMap((i) => (isGroup(i) ? i.tabs : [i]));

  const activeHref = (() => {
    const matches = flat
      .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
      .sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href ?? flat[0]?.href ?? "";
  })();
  const active = (href: string) => href === activeHref;
  const groupActive = (g: NavGroup) => g.tabs.some((t) => active(t.href));

  const linkStyle = (on: boolean) => ({
    borderBottom: on ? "2px solid var(--color-brand-600)" : "2px solid transparent",
    color: on ? "var(--fg)" : "var(--muted)",
    fontWeight: on ? 600 : 400,
  });

  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      {/* mobile: jump menu with groups */}
      <div className="sm:hidden">
        <label className="sr-only" htmlFor="nav-jump">Section</label>
        <select
          id="nav-jump"
          value={activeHref}
          onChange={(e) => router.push(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {tabs.map((i) =>
            isGroup(i) ? (
              <optgroup key={i.label} label={i.label}>
                {i.tabs.map((t) => (
                  <option key={t.href} value={t.href}>{t.label}</option>
                ))}
              </optgroup>
            ) : (
              <option key={i.href} value={i.href}>{i.label}</option>
            ),
          )}
        </select>
      </div>

      {/* desktop: tabs + grouped dropdowns */}
      <nav className="hidden items-end gap-1 overflow-x-auto pb-px text-sm sm:flex" style={{ scrollbarWidth: "none" }}>
        {tabs.map((i) =>
          isGroup(i) ? (
            <details key={i.label} className="group relative shrink-0">
              <summary
                className="flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-t-md px-3 py-2"
                style={linkStyle(groupActive(i))}
              >
                {i.label}
                <span aria-hidden style={{ color: "var(--muted)" }}>▾</span>
              </summary>
              <div
                className="absolute left-0 z-20 mt-1 flex min-w-40 flex-col rounded-lg border py-1 shadow-lg"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                {i.tabs.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                    className="px-3 py-1.5 hover:bg-[var(--surface-2)]"
                    style={{ color: active(t.href) ? "var(--fg)" : "var(--muted)", fontWeight: active(t.href) ? 600 : 400 }}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <Link
              key={i.href}
              href={i.href}
              className="shrink-0 whitespace-nowrap rounded-t-md px-3 py-2"
              style={linkStyle(active(i.href))}
            >
              {i.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
