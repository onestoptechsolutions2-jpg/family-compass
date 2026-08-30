"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string };

export function NavTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-px text-sm" style={{ borderColor: "var(--border)" }}>
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-t-md px-3 py-2"
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
  );
}
