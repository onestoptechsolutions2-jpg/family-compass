"use client";

import { useEffect, useRef, useState } from "react";

import type { ShowcaseTree } from "@/lib/queries/showcase";

const INTERVAL = 4500;

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || to < 20) {
      setN(to);
      return;
    }
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [to]);
  return <>{n.toLocaleString()}</>;
}

/**
 * A rotating showcase of the largest family trees on the platform — proof of
 * use for the public landing page. Auto-advances, pauses on hover/focus,
 * respects reduced motion, swipeable.
 */
export function ProofCarousel({ trees }: { trees: ShowcaseTree[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = trees.length;

  useEffect(() => {
    if (n < 2 || paused) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setI((c) => (c + 1) % n), INTERVAL);
    return () => clearInterval(id);
  }, [n, paused]);

  if (n === 0) return null;
  const t = trees[i]!;
  const place = [t.community, t.region].filter(Boolean).join(" · ");

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const s = touch.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        if (s != null && end != null && Math.abs(end - s) > 40) {
          setI((c) => (end < s ? (c + 1) % n : (c - 1 + n) % n));
        }
        touch.current = null;
      }}
      aria-roledescription="carousel"
    >
      <div key={t.id} className="flex flex-col gap-4 p-6 sm:p-8" style={{ animation: "fc-fade .4s ease" }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
            Family {i + 1} of {n}
          </p>
          <h3 className="mt-1 font-serif text-2xl">{t.name}</h3>
          {place && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>{place}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-6">
          {[
            { v: t.people, l: "people" },
            { v: t.families, l: "families" },
            { v: t.clans, l: t.clans === 1 ? "clan" : "clans" },
          ]
            .filter((s) => s.v > 0)
            .map((s) => (
              <div key={s.l}>
                <div className="text-3xl font-semibold tabular-nums">
                  <CountUp to={s.v} />
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{s.l}</div>
              </div>
            ))}
        </div>
      </div>

      {n > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {trees.map((tt, idx) => (
            <button
              key={tt.id}
              aria-label={`Show family ${idx + 1}`}
              onClick={() => setI(idx)}
              className="h-1.5 w-6 rounded-full transition-colors"
              style={{ background: idx === i ? "var(--accent)" : "var(--surface-2)" }}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes fc-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
