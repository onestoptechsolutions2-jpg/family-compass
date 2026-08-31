"use client";

import { useEffect, useRef, useState } from "react";

export type BookPage = { id: string; node: React.ReactNode };

/**
 * A lightweight page-turning viewer for the memorial book. One page on screen
 * at a time; prev/next buttons, arrow keys, and horizontal swipe. Pages are
 * server-rendered HTML passed in as `pages` — no PDF, no external library.
 *
 * "Read fullscreen" uses the Fullscreen API where available and always falls
 * back to a fixed full-viewport overlay, so it works on iOS Safari too.
 */
export function FlipBook({ pages }: { pages: BookPage[] }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const touch = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const n = pages.length;

  const go = (next: number) => setI((cur) => Math.max(0, Math.min(n - 1, next ?? cur)));

  const exitFull = () => {
    setFull(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  const enterFull = () => {
    setFull(true);
    wrapRef.current?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
      if (e.key === "Escape" && full) exitFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, full]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  if (n === 0) return null;

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      touch.current = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = touch.current;
      const end = e.changedTouches[0]?.clientX ?? null;
      if (start != null && end != null && Math.abs(end - start) > 50) {
        go(end < start ? i + 1 : i - 1);
      }
      touch.current = null;
    },
  };

  return (
    <div
      ref={wrapRef}
      className={
        full
          ? "fixed inset-0 z-[80] flex flex-col gap-3 overflow-auto p-4 sm:p-6"
          : "flex flex-col gap-3"
      }
      style={full ? { background: "var(--bg, var(--surface))" } : undefined}
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={full ? exitFull : enterFull}
          className="rounded-full border px-3 py-1 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {full ? "✕ Close" : "⛶ Read fullscreen"}
        </button>
      </div>

      <div
        {...swipe}
        className={`relative mx-auto w-full overflow-hidden rounded-2xl border shadow-sm ${
          full ? "max-w-2xl" : "max-w-md"
        }`}
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          aspectRatio: "3 / 4",
          maxHeight: full ? "calc(100dvh - 8rem)" : undefined,
        }}
      >
        <div
          className="absolute inset-0 overflow-y-auto p-6 leading-relaxed"
          style={{ fontSize: full ? "1.05rem" : "15px" }}
        >
          {pages[i]?.node}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md items-center justify-between">
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
