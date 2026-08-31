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
      <nav className="hidden flex-wrap items-end gap-1 pb-px text-sm sm:flex">
        {tabs.map((i) =>
          isGroup(i) ? (
            <details
              key={i.label}
              className="group relative"
              onKeyDown={(e) => {
                const d = e.currentTarget;
                const items = Array.from(d.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'));
                const summary = d.querySelector<HTMLElement>("summary");
                if (e.key === "Escape") {
                  d.removeAttribute("open");
                  summary?.focus();
                  return;
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!d.open) {
                    d.setAttribute("open", "");
                    items[0]?.focus();
                    return;
                  }
                  const idx = items.indexOf(document.activeElement as HTMLAnchorElement);
                  const next =
                    e.key === "ArrowDown"
                      ? items[(idx + 1 + items.length) % items.length]
                      : items[(idx - 1 + items.length) % items.length];
                  next?.focus();
                }
              }}
            >
              <summary
                className="flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-t-md px-3 py-2 [&::-webkit-details-marker]:hidden"
                style={linkStyle(groupActive(i))}
              >
                {i.label}
                <span aria-hidden className="text-xs transition-transform group-open:rotate-180" style={{ color: "var(--muted)" }}>▾</span>
              </summary>
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-1 flex min-w-40 flex-col rounded-lg border py-1 shadow-lg"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                {i.tabs.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    role="menuitem"
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
              className="whitespace-nowrap rounded-t-md px-3 py-2"
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
