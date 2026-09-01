"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type GapItem = { id: string; kind: string; question: string; href: string; cta: string };
export type GapAncestry = {
  present: number;
  target: number;
  score: number;
  byGen: { label: string; present: number; target: number }[];
};

/**
 * Persistent "complete this profile" wizard. Recomputed server-side every
 * load; hides per-profile via localStorage but always leaves a way back.
 * The goal it works toward: four generations of ancestry.
 */
export function ProfileGaps({
  personId,
  self,
  ancestry,
  gaps,
}: {
  personId: string;
  self: boolean;
  ancestry: GapAncestry;
  gaps: GapItem[];
}) {
  const key = `fc_gaps_hidden_${personId}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (gaps.length === 0) return null;

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

  const who = self ? "your profile" : "this profile";

  if (hidden) {
    return (
      <button onClick={show} className="self-start text-xs hover:underline" style={{ color: "var(--link)" }}>
        Complete {who} ({ancestry.present}/{ancestry.target} ancestors · {gaps.length} to do)
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
            Complete {who}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">
            {self ? "A few things only you know" : "Missing pieces"}
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            The aim is four generations — {self ? "you" : "them"}, parents, grandparents,
            great-grandparents. {ancestry.present} of {ancestry.target} ancestors recorded.
          </p>
        </div>
        <button onClick={hide} className="shrink-0 text-xs hover:underline" style={{ color: "var(--muted)" }}>
          hide
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
        {ancestry.byGen.map((g) => (
          <span key={g.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  g.present >= g.target ? "#22c55e" : g.present > 0 ? "#eab308" : "#ef4444",
              }}
            />
            {g.label} <span className="tabular-nums">{Math.min(g.present, g.target)}/{g.target}</span>
          </span>
        ))}
      </div>

      <ol className="flex flex-col gap-1.5 text-sm">
        {gaps.slice(0, 7).map((g) => (
          <li key={g.id} className="flex items-center gap-2">
            <span style={{ color: "var(--muted)" }}>○</span>
            <span className="min-w-0 flex-1">{g.question}</span>
            <Link href={g.href} className="shrink-0 text-xs hover:underline" style={{ color: "var(--link)" }}>
              {g.cta} →
            </Link>
          </li>
        ))}
      </ol>
      {gaps.length > 7 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          +{gaps.length - 7} more once these are done.
        </p>
      )}
    </div>
  );
}
