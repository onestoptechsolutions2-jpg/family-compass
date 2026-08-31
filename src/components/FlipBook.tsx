"use client";

import { useEffect, useRef, useState } from "react";

export type BookPage = { id: string; node: React.ReactNode };

/**
 * A lightweight page-turning viewer for the memorial book. One page on screen
 * at a time; prev/next buttons, arrow keys, and horizontal swipe. Pages are
 * server-rendered HTML passed in as `pages` — no PDF, no external library.
 */
export function FlipBook({ pages }: { pages: BookPage[] }) {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const n = pages.length;

  const go = (next: number) => setI((cur) => Math.max(0, Math.min(n - 1, next ?? cur)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (n === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div
        onTouchStart={(e) => {
          touch.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const end = e.changedTouches[0]?.clientX ?? null;
          if (start != null && end != null && Math.abs(end - start) > 50) {
            go(end < start ? i + 1 : i - 1);
          }
          touch.current = null;
        }}
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border shadow-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)", aspectRatio: "3 / 4" }}
      >
        <div className="absolute inset-0 overflow-y-auto p-6 text-[15px] leading-relaxed">
          {pages[i]?.node}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className="rounded-full border px-4 py-1.5 text-sm disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          ← Prev
        </button>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {i + 1} / {n}
        </span>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={i === n - 1}
          className="rounded-full border px-4 py-1.5 text-sm disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          Next →
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {pages.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Go to page ${idx + 1}`}
            onClick={() => go(idx)}
            className="h-1.5 w-6 rounded-full"
            style={{ background: idx === i ? "var(--accent)" : "var(--surface-2)" }}
          />
        ))}
      </div>
    </div>
  );
}
