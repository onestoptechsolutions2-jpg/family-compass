"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small "Actions ▾" dropdown. Children are the menu items — links, form
 * buttons, or <Dialog> triggers. The panel closes on outside-click, Escape,
 * or when an item is clicked.
 *
 * The panel stays mounted (just hidden) so that a <Dialog> opened from inside
 * it keeps its modal on screen after the menu collapses.
 */
export function ActionMenu({
  label = "Actions",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium"
        style={{
          borderColor: "var(--color-brand-600)",
          color: "var(--color-brand-700)",
          background: open ? "var(--surface-2)" : "var(--surface)",
        }}
      >
        {label} <span aria-hidden>▾</span>
      </button>

      <div
        role="menu"
        hidden={!open}
        onClick={() => setOpen(false)}
        className="absolute right-0 z-20 mt-1 flex min-w-44 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border py-1 text-sm shadow-lg"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Shared look for a menu row (link / button / dialog trigger). */
export const actionItemClass =
  "block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-2)]";
