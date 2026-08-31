"use client";

import { useEffect, useId, useState } from "react";

export type TabItem = {
  id: string;
  label: React.ReactNode;
  /** small count / badge shown after the label */
  badge?: number;
  panel: React.ReactNode;
};

/**
 * Accessible tab strip + panels. Keeps long config pages navigable: only the
 * active panel is in the layout, the rest stay mounted but hidden so form
 * state and server-rendered content survive a tab switch.
 *
 * The active tab is remembered in the URL hash (`#tab=<id>`) so a refresh or a
 * shared link lands on the same panel.
 */
export function Tabs({ items, initial }: { items: TabItem[]; initial?: string }) {
  const base = useId();
  const first = items[0]?.id ?? "";
  const [active, setActive] = useState(initial ?? first);

  useEffect(() => {
    const fromHash = () => {
      const m = /(?:^|[#&])tab=([^&]+)/.exec(window.location.hash);
      const id = m?.[1] ? decodeURIComponent(m[1]) : null;
      if (id && items.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [items]);

  const select = (id: string) => {
    setActive(id);
    try {
      history.replaceState(null, "", `#tab=${encodeURIComponent(id)}`);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="-mb-px flex flex-wrap gap-1 overflow-x-auto border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {items.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const i = items.findIndex((x) => x.id === active);
                const next = e.key === "ArrowRight" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
                select(items[next]!.id);
              }}
              className="whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium"
              style={{
                borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent",
                color: on ? "var(--fg)" : "var(--muted)",
                background: on ? "var(--surface)" : "transparent",
              }}
            >
              {t.label}
              {t.badge ? (
                <span
                  className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
          className="flex flex-col gap-6"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
