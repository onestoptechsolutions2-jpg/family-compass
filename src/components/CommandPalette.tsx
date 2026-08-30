"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Hit = { type: string; id: string; label: string; sub?: string; href: string; icon: string };

const MENU: { icon: string; label: string; href: (t: string | null) => string | null; hint?: string }[] = [
  { icon: "➕", label: "Add a person", href: (t) => (t ? `/trees/${t}/people/new` : null) },
  { icon: "🧭", label: "Explore the tree", href: (t) => (t ? `/trees/${t}/tree` : null) },
  { icon: "❓", label: "Are we related?", href: (t) => (t ? `/trees/${t}/relationship` : null) },
  { icon: "📊", label: "Reports", href: (t) => (t ? `/trees/${t}/reports` : null) },
  { icon: "🔗", label: "Sharing links", href: (t) => (t ? `/trees/${t}/sharing` : null) },
  { icon: "🪶", label: "Clans", href: (t) => (t ? `/trees/${t}/clans` : null) },
  { icon: "🏠", label: "All your trees", href: () => "/app" },
  { icon: "🌍", label: "Discover families", href: () => "/discover" },
  { icon: "🔔", label: "Notifications", href: () => "/notifications" },
  { icon: "📖", label: "API & webhook docs", href: () => "/docs" },
  { icon: "📜", label: "Policies", href: () => "/policies" },
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const treeId = useMemo(() => pathname.match(/^\/trees\/([^/]+)/)?.[1] ?? null, [pathname]);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
    else {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}${treeId ? `&tree=${treeId}` : ""}`,
          { signal: ctl.signal },
        );
        const data = await res.json();
        setHits(Array.isArray(data.hits) ? data.hits : []);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, open, treeId]);

  const menuItems = useMemo(
    () => MENU.map((m) => ({ ...m, target: m.href(treeId) })).filter((m) => m.target),
    [treeId],
  );

  const rows: { icon: string; label: string; sub?: string; href: string }[] =
    q.trim().length >= 2
      ? hits.map((h) => ({ icon: h.icon, label: h.label, sub: h.sub, href: h.href }))
      : menuItems.map((m) => ({ icon: m.icon, label: m.label, href: m.target! }));

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = rows[active];
      if (r) go(r.href);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }}
        aria-label="Search"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border px-1 text-[10px] sm:inline" style={{ borderColor: "var(--border)" }}>⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
          style={{ background: "rgb(15 17 22 / 0.45)", backdropFilter: "blur(2px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--border)", background: "var(--elevated)", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={treeId ? "Search people, families, places, clans, memorials…" : "Search your people…"}
              className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none"
              style={{ borderColor: "var(--hairline)" }}
            />
            <div className="max-h-[55vh] overflow-y-auto py-1">
              {q.trim().length < 2 && (
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Jump to
                </div>
              )}
              {loading && q.trim().length >= 2 && (
                <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>Searching…</div>
              )}
              {!loading && q.trim().length >= 2 && rows.length === 0 && (
                <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>No matches for “{q}”.</div>
              )}
              {rows.map((r, i) => (
                <button
                  key={r.href + i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm"
                  style={{ background: i === active ? "var(--surface-2)" : "transparent" }}
                >
                  <span className="w-5 shrink-0 text-center">{r.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  {r.sub && (
                    <span className="shrink-0 truncate text-xs" style={{ color: "var(--muted)" }}>{r.sub}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-4 py-2 text-[11px]" style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
              <span>↑↓ move · ↵ open · esc close</span>
              <span>Family Compass</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
