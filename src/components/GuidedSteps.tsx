"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { GuideStep } from "@/lib/queries/guide";

/** Collapsible "getting started" checklist. Hides itself once every step is
 *  done, or when the user dismisses it (remembered per tree). */
export function GuidedSteps({
  treeId,
  steps,
  doneCount,
  total,
}: {
  treeId: string;
  steps: GuideStep[];
  doneCount: number;
  total: number;
}) {
  const key = `fc_guide_hidden_${treeId}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (doneCount >= total) return null;
  if (hidden) {
    return (
      <button
        onClick={() => {
          try {
            localStorage.removeItem(key);
          } catch {
            /* ignore */
          }
          setHidden(false);
        }}
        className="self-start text-xs hover:underline"
        style={{ color: "var(--link)" }}
      >
        Show the getting-started guide ({doneCount}/{total})
      </button>
    );
  }

  const pct = Math.round((doneCount / total) * 100);
  const next = steps.filter((s) => !s.done).slice(0, 3);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Getting started</h2>
        <button
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
          className="text-xs hover:underline"
          style={{ color: "var(--muted)" }}
        >
          Hide
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-brand-500)" }} />
        </span>
        <span className="tabular-nums">{doneCount}/{total}</span>
      </div>

      <ol className="mt-3 flex flex-col gap-2 text-sm">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px]"
              style={{
                background: s.done ? "var(--color-brand-600)" : "var(--surface-2)",
                color: s.done ? "#fff" : "var(--muted)",
                border: s.done ? "none" : "1px solid var(--border)",
              }}
            >
              {s.done ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className={s.done ? "line-through" : "font-medium"} style={s.done ? { color: "var(--muted)" } : undefined}>
                {s.title}
              </span>
              {!s.done && (
                <>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>{s.hint}</span>
                </>
              )}
            </span>
            {!s.done && (
              <Link
                href={s.href}
                className="shrink-0 rounded-md border px-2 py-0.5 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {next.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
          Next: <Link href={next[0]!.href} className="hover:underline" style={{ color: "var(--link)" }}>{next[0]!.cta}</Link>
          {" · "}
          <Link href="/guide" className="hover:underline" style={{ color: "var(--link)" }}>full walkthrough</Link>
        </p>
      )}
    </div>
  );
}
