"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { BereaveStep } from "@/lib/bereavement";

/**
 * A gentle, persistent checklist for the days after a death is recorded:
 * burial, memorial, programme, inviting relatives, welfare fund, publishing.
 * Recomputed every load; hides per-person via localStorage but always leaves
 * a way back. Self-removes once every step is done.
 */
export function BereavementWizard({
  personId,
  name,
  steps,
}: {
  personId: string;
  name: string;
  steps: BereaveStep[];
}) {
  const key = `fc_bereave_hidden_${personId}`;
  const doneCount = steps.filter((s) => s.done).length;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (steps.length === 0 || doneCount === steps.length) return null;

  const show = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setHidden(false);
  };
  const hide = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  if (hidden) {
    return (
      <button onClick={show} className="self-start text-xs hover:underline" style={{ color: "var(--link)" }}>
        Funeral checklist ({doneCount}/{steps.length})
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
            After a death
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">Arranging things for {name}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Take these in your own time — {doneCount} of {steps.length} done. Recording the burial
            here also puts it on the family tree.
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
