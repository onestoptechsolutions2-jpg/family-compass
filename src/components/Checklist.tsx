"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ChecklistStep = {
  key: string;
  done: boolean;
  label: string;
  href: string;
  cta: string;
};

/**
 * A persistent, self-clearing checklist. Recomputed server-side each load;
 * hides via localStorage but always leaves a "way back" button; removes
 * itself once every step is done. Shared by the bereavement / marriage
 * wizards.
 */
export function Checklist({
  storageKey,
  eyebrow,
  title,
  subtitle,
  steps,
  collapsedLabel,
}: {
  storageKey: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: ChecklistStep[];
  collapsedLabel: (done: number, total: number) => string;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [storageKey]);

  if (steps.length === 0 || doneCount === steps.length) return null;

  const show = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setHidden(false);
  };
  const hide = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  if (hidden) {
    return (
      <button onClick={show} className="self-start text-xs hover:underline" style={{ color: "var(--link)" }}>
        {collapsedLabel(doneCount, steps.length)}
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">{title}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {subtitle} — {doneCount} of {steps.length} done.
          </p>
        </div>
        <button onClick={hide} className="shrink-0 text-xs hover:underline" style={{ color: "var(--muted)" }}>
          hide
        </button>
      </div>
      <ol className="flex flex-col gap-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span style={{ color: s.done ? "var(--success)" : "var(--muted)" }}>{s.done ? "✓" : "○"}</span>
            <span style={s.done ? { color: "var(--muted)", textDecoration: "line-through" } : undefined}>
              {s.label}
            </span>
            {!s.done && (
              <Link href={s.href} className="ml-auto shrink-0 text-xs hover:underline" style={{ color: "var(--link)" }}>
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
