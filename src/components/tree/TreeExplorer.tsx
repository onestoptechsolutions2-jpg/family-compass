"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { select } from "d3-selection";
import "d3-transition"; // augments Selection with .transition()
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";

import type { TreeGraph } from "@/lib/queries/graph";
import {
  CARD_W,
  CARD_H,
  computeLayout,
  linkPath,
  type Layout,
  type Mode,
  type PositionedNode,
} from "./layout";
import { computeFan } from "./fan";

type ViewMode = Mode | "fan";

const MODE_LABELS: Record<ViewMode, string> = {
  hourglass: "Hourglass",
  ancestors: "Ancestors",
  descendants: "Descendants",
  fan: "Fan chart",
};

function initials(given: string, surname: string) {
  return ((given[0] ?? "") + (surname[0] ?? "")).toUpperCase() || "?";
}

function genderFill(gender: string) {
  if (gender === "MALE") return "url(#g-male)";
  if (gender === "FEMALE") return "url(#g-female)";
  return "url(#g-other)";
}

export function TreeExplorer({
  treeId,
  graph,
  initialCenterId,
  homePersonId,
  canManage,
  setHomeAction,
  readOnly = false,
  shareSlug,
  allowClaims = false,
  initialMode,
  initialGens,
}: {
  treeId: string;
  graph: TreeGraph;
  initialCenterId: string | null;
  homePersonId: string | null;
  canManage: boolean;
  setHomeAction?: (personId: string) => Promise<void>;
  readOnly?: boolean;
  shareSlug?: string;
  allowClaims?: boolean;
  initialMode?: ViewMode;
  initialGens?: number;
}) {
  const personList = useMemo(
    () =>
      Object.values(graph.persons)
        .map((p) => ({ id: p.id, label: p.name + (p.birthYear ? ` (${p.birthYear})` : "") }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [graph.persons],
  );

  const [centerId, setCenterId] = useState<string | null>(
    initialCenterId && graph.persons[initialCenterId] ? initialCenterId : (personList[0]?.id ?? null),
  );
  const [mode, setMode] = useState<ViewMode>(initialMode ?? "hourglass");
  const [gens, setGens] = useState(initialGens ?? 4);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isSaving, startSave] = useTransition();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  // ----- time dimension (the "4D" scrubber) -----
  const yearBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of Object.values(graph.persons)) {
      if (p.birthYear) {
        min = Math.min(min, p.birthYear);
        max = Math.max(max, p.birthYear);
      }
      if (p.deathYear) max = Math.max(max, p.deathYear);
    }
    const now = new Date().getFullYear();
    if (!isFinite(min)) return { min: 1900, max: now };
    return { min: Math.floor(min / 10) * 10, max: Math.max(max, now) };
  }, [graph.persons]);

  const [timeOn, setTimeOn] = useState(false);
  const [year, setYear] = useState(yearBounds.max);
  const [playing, setPlaying] = useState(false);

  useEffect(() => setYear(yearBounds.max), [yearBounds.max]);

  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, Math.round((yearBounds.max - yearBounds.min) / 120));
    const id = setInterval(() => {
      setYear((y) => {
        if (y >= yearBounds.max) {
          setPlaying(false);
          return yearBounds.max;
        }
        return Math.min(yearBounds.max, y + step);
      });
    }, 90);
    return () => clearInterval(id);
  }, [playing, yearBounds.min, yearBounds.max]);

  const phaseOf = (p: { birthYear: number | null; deathYear: number | null }) => {
    if (!timeOn) return "on" as const;
    if (p.birthYear && p.birthYear > year) return "unborn" as const;
    if (p.deathYear && p.deathYear <= year) return "past" as const;
    return "on" as const;
  };

  // ----- layout -----
  const layout: Layout | null = useMemo(() => {
    if (!centerId || mode === "fan") return null;
    return computeLayout(graph, centerId, mode, gens);
  }, [graph, centerId, mode, gens]);

  const fan = useMemo(() => {
    if (!centerId || mode !== "fan") return null;
    return computeFan(graph, centerId, Math.min(gens + 1, 7));
  }, [graph, centerId, mode, gens]);

  // ----- zoom wiring -----
  useEffect(() => {
    if (!svgRef.current) return;
    const sel = select(svgRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 2.6])
      .on("zoom", (e) => setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k }));
    zoomRef.current = z;
    sel.call(z).on("dblclick.zoom", null);
    return () => {
      sel.on(".zoom", null);
    };
  }, []);

  // ----- measure -----
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitToView = useCallback(
    (animate = true) => {
      if (!svgRef.current || !zoomRef.current) return;
      let b: { minX: number; minY: number; maxX: number; maxY: number };
      if (layout) b = layout.bounds;
      else if (fan) b = { minX: -fan.radius, maxX: fan.radius, minY: -fan.radius, maxY: fan.radius };
      else return;

      const pad = 60;
      const bw = b.maxX - b.minX + pad * 2;
      const bh = b.maxY - b.minY + pad * 2;
      const k = Math.max(0.12, Math.min(1.4, Math.min(size.w / bw, size.h / bh)));
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const t = zoomIdentity.translate(size.w / 2, size.h / 2).scale(k).translate(-cx, -cy);
      const sel = select(svgRef.current);
      (animate ? sel.transition().duration(420) : sel).call(zoomRef.current.transform, t);
    },
    [layout, fan, size.w, size.h],
  );

  useEffect(() => {
    const id = setTimeout(() => fitToView(true), 20);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, mode, gens, size.w, size.h]);

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(180).call(zoomRef.current.scaleBy, factor);
  };

  const center = centerId ? graph.persons[centerId] : null;

  // ----- keyboard nav -----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!layout || !centerId) return;
    const self = layout.nodes.find((n) => n.personId === centerId && n.role === "center");
    if (!self) return;
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
      e.key
    ] as [number, number] | undefined;
    if (!dir) return;
    e.preventDefault();
    let best: PositionedNode | null = null;
    let bestScore = Infinity;
    for (const n of layout.nodes) {
      if (n.key === self.key) continue;
      const dx = n.x - self.x;
      const dy = n.y - self.y;
      const align = dx * dir[0] + dy * dir[1];
      if (align <= 0) continue;
      const off = Math.abs(dx * dir[1] - dy * dir[0]);
      const score = off * 2 - align * 0.2;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best) setCenterId(best.personId);
  };

  if (!centerId || !center) {
    return (
      <div
        className="rounded-xl border p-8 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        Add people and relationships, then come back to explore the tree visually.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1 rounded-full border p-1"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          {(Object.keys(MODE_LABELS) as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-full px-3 py-1 text-sm"
              style={{
                background: mode === m ? "var(--color-brand-600)" : "transparent",
                color: mode === m ? "#fff" : "var(--muted)",
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <label
          className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <span style={{ color: "var(--muted)" }}>Generations</span>
          <input
            type="range"
            min={2}
            max={6}
            value={gens}
            onChange={(e) => setGens(Number(e.target.value))}
          />
          <span className="tabular-nums">{gens}</span>
        </label>

        <input
          list="tree-people"
          placeholder="Jump to person…"
          className="rounded-full border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)", minWidth: 200 }}
          onChange={(e) => {
            const hit = personList.find((p) => p.label === e.target.value);
            if (hit) setCenterId(hit.id);
          }}
        />
        <datalist id="tree-people">
          {personList.map((p) => (
            <option key={p.id} value={p.label} />
          ))}
        </datalist>

        {mode !== "fan" && (
          <button
            onClick={() => {
              setTimeOn((v) => !v);
              setPlaying(false);
            }}
            className="tbtn px-3"
            style={timeOn ? { background: "var(--color-brand-600)", color: "#fff", borderColor: "var(--color-brand-600)" } : undefined}
          >
            ⏱ Timeline
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => zoomBy(1.25)} className="tbtn">
            +
          </button>
          <button onClick={() => zoomBy(0.8)} className="tbtn">
            −
          </button>
          <button onClick={() => fitToView(true)} className="tbtn px-3">
            Fit
          </button>
          {homePersonId && homePersonId !== centerId && (
            <button onClick={() => setCenterId(homePersonId)} className="tbtn px-3">
              Home
            </button>
          )}
          {!readOnly && canManage && setHomeAction && centerId !== homePersonId && (
            <button
              onClick={() => {
                const action = setHomeAction;
                startSave(() => action(centerId));
              }}
              disabled={isSaving}
              className="tbtn px-3"
            >
              {isSaving ? "Saving…" : "Set as home"}
            </button>
          )}
        </div>
      </div>

      {/* Timeline scrubber */}
      {timeOn && mode !== "fan" && layout && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-full border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <button onClick={() => setPlaying((v) => !v)} className="tbtn px-3">
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <span className="tabular-nums font-semibold" style={{ minWidth: 44 }}>{year}</span>
          <input
            type="range"
            min={yearBounds.min}
            max={yearBounds.max}
            value={year}
            onChange={(e) => {
              setPlaying(false);
              setYear(Number(e.target.value));
            }}
            className="min-w-[160px] flex-1"
          />
          <span style={{ color: "var(--muted)" }}>
            {layout.nodes.filter((n) => {
              const p = graph.persons[n.personId];
              return p && phaseOf(p) === "on";
            }).length}{" "}
            alive
          </span>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--bg)", height: "70vh", minHeight: 460 }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          tabIndex={0}
          onKeyDown={onKeyDown}
          style={{ display: "block", cursor: "grab", outline: "none" }}
        >
          <defs>
            <linearGradient id="g-male" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6366f1" />
              <stop offset="1" stopColor="#4338ca" />
            </linearGradient>
            <linearGradient id="g-female" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f472b6" />
              <stop offset="1" stopColor="#db2777" />
            </linearGradient>
            <linearGradient id="g-other" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#94a3b8" />
              <stop offset="1" stopColor="#475569" />
            </linearGradient>
            <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="var(--border)" opacity="0.5" />
            </pattern>
            <filter id="card-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>
          </defs>

          <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#dots)" />

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {layout && (
              <>
                {layout.edges.map((e) => (
                  <path
                    key={e.id}
                    d={linkPath(e)}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={e.kind === "couple" ? 2 : 1.6}
                    strokeDasharray={e.kind === "couple" ? "4 4" : undefined}
                    opacity={timeOn ? 0.4 : 1}
                    style={{ stroke: e.kind === "couple" ? "var(--color-brand-500)" : undefined }}
                  />
                ))}
                {layout.nodes.map((n) => {
                  const p = graph.persons[n.personId];
                  if (!p) return null;
                  const isCenter = n.role === "center";
                  const hovered = hoverId === n.key;
                  const h = isCenter ? CARD_H + 8 : CARD_H;
                  const phase = phaseOf(p);
                  const nodeOpacity = phase === "unborn" ? 0.08 : phase === "past" ? 0.5 : 1;
                  return (
                    <g
                      key={n.key}
                      transform={`translate(${n.x - CARD_W / 2},${n.y - h / 2})`}
                      onClick={() => phase !== "unborn" && setCenterId(n.personId)}
                      onMouseEnter={() => setHoverId(n.key)}
                      onMouseLeave={() => setHoverId((v) => (v === n.key ? null : v))}
                      opacity={nodeOpacity}
                      style={{
                        cursor: phase === "unborn" ? "default" : "pointer",
                        transition: "opacity 120ms linear",
                        pointerEvents: phase === "unborn" ? "none" : "auto",
                      }}
                    >
                      {phase === "past" && (
                        <text x={CARD_W - 12} y={16} textAnchor="end" fontSize={13} fill="var(--muted)">
                          †
                        </text>
                      )}
                      <rect
                        width={CARD_W}
                        height={h}
                        rx={14}
                        fill="var(--card)"
                        stroke={isCenter ? "var(--color-brand-600)" : "var(--border)"}
                        strokeWidth={isCenter ? 2.5 : 1}
                        filter={hovered || isCenter ? "url(#card-shadow)" : undefined}
                      />
                      <circle cx={26} cy={h / 2} r={17} fill={genderFill(p.gender)} />
                      <text
                        x={26}
                        y={h / 2 + 4}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={700}
                        fill="#fff"
                      >
                        {initials(p.given, p.surname)}
                      </text>
                      <text x={52} y={h / 2 - 4} fontSize={13} fontWeight={600} fill="var(--fg)">
                        {p.name.length > 20 ? p.name.slice(0, 19) + "…" : p.name}
                      </text>
                      <text x={52} y={h / 2 + 14} fontSize={11} fill="var(--muted)">
                        {[p.birthYear, p.deathYear].some(Boolean)
                          ? `${p.birthYear ?? "?"} – ${p.deathYear ?? (p.living ? "" : "?")}`
                          : p.living
                            ? "living"
                            : ""}
                      </text>
                      {isCenter && (
                        <text
                          x={CARD_W / 2}
                          y={-8}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill="var(--color-brand-600)"
                          letterSpacing="0.08em"
                        >
                          FOCUS
                        </text>
                      )}
                    </g>
                  );
                })}
              </>
            )}

            {fan && (
              <g>
                {fan.segments.map((s) => {
                  const p = graph.persons[s.personId];
                  if (!p) return null;
                  const hue =
                    s.generation === 0
                      ? "var(--color-brand-600)"
                      : p.gender === "MALE"
                        ? "#c7d2fe"
                        : p.gender === "FEMALE"
                          ? "#fbcfe8"
                          : "#e2e8f0";
                  return (
                    <g
                      key={s.key}
                      onClick={() => setCenterId(s.personId)}
                      style={{ cursor: "pointer" }}
                    >
                      <path
                        d={s.d}
                        fill={hue}
                        stroke="var(--bg)"
                        strokeWidth={1.5}
                        opacity={hoverId === s.key ? 0.85 : 1}
                        onMouseEnter={() => setHoverId(s.key)}
                        onMouseLeave={() => setHoverId((v) => (v === s.key ? null : v))}
                      />
                      {s.generation === 0 ? (
                        <text textAnchor="middle" y={4} fontSize={11} fontWeight={700} fill="#fff">
                          {initials(p.given, p.surname)}
                        </text>
                      ) : (
                        s.generation <= 4 && (
                          <text
                            transform={`translate(${s.labelX},${s.labelY}) rotate(${s.labelAngleDeg})`}
                            textAnchor="middle"
                            fontSize={s.generation <= 2 ? 11 : 9}
                            fill="#1e293b"
                          >
                            {(p.given || p.surname || p.name).slice(0, s.generation <= 2 ? 12 : 8)}
                          </text>
                        )
                      )}
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        </svg>

        {/* hover facts */}
        {hoverId &&
          (() => {
            const node = layout?.nodes.find((n) => n.key === hoverId);
            const pid = node?.personId ?? fan?.segments.find((s) => s.key === hoverId)?.personId;
            const p = pid ? graph.persons[pid] : null;
            if (!p || !pid) return null;
            const claimable =
              readOnly && allowClaims && shareSlug && pid && !p.name.startsWith("Living ");

            const nameOf = (id: string) => graph.persons[id]?.name ?? null;
            const parents = (graph.up[pid] ?? []).map(nameOf).filter(Boolean) as string[];
            const spouses = (graph.spouses[pid] ?? []).map(nameOf).filter(Boolean) as string[];
            const childIds = graph.down[pid] ?? [];
            const siblingCount = new Set(
              (graph.up[pid] ?? []).flatMap((par) => graph.down[par] ?? []).filter((id) => id !== pid),
            ).size;
            const lifespan =
              p.birthYear && p.deathYear ? `${p.deathYear - p.birthYear} yrs` : null;
            const yrs = [p.birthYear, p.deathYear].some(Boolean)
              ? `${p.birthYear ?? "?"} – ${p.deathYear ?? (p.living ? "present" : "?")}`
              : p.living
                ? "living"
                : null;

            return (
              <div
                className="pointer-events-none absolute left-3 top-3 rounded-xl border px-3 py-2 text-sm shadow-lg"
                style={{ borderColor: "var(--border)", background: "var(--card)", maxWidth: 300 }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                    style={{
                      background:
                        p.gender === "MALE" ? "#4338ca" : p.gender === "FEMALE" ? "#db2777" : "#475569",
                    }}
                  >
                    {((p.given[0] ?? "") + (p.surname[0] ?? "")).toUpperCase() || "?"}
                  </span>
                  <div>
                    <div className="font-semibold leading-tight">{p.name}</div>
                    {yrs && (
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {yrs}
                        {lifespan ? ` · ${lifespan}` : ""}
                      </div>
                    )}
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                  {p.birth && (
                    <>
                      <dt style={{ color: "var(--muted)" }}>Born</dt>
                      <dd>{p.birth}</dd>
                    </>
                  )}
                  {p.death && (
                    <>
                      <dt style={{ color: "var(--muted)" }}>Died</dt>
                      <dd>{p.death}</dd>
                    </>
                  )}
                  {parents.length > 0 && (
                    <>
                      <dt style={{ color: "var(--muted)" }}>Parents</dt>
                      <dd>{parents.join(" & ")}</dd>
                    </>
                  )}
                  {spouses.length > 0 && (
                    <>
                      <dt style={{ color: "var(--muted)" }}>
                        {spouses.length > 1 ? "Partners" : "Partner"}
                      </dt>
                      <dd>{spouses.join(", ")}</dd>
                    </>
                  )}
                  {(childIds.length > 0 || siblingCount > 0) && (
                    <>
                      <dt style={{ color: "var(--muted)" }}>Family</dt>
                      <dd>
                        {childIds.length > 0 ? `${childIds.length} child${childIds.length === 1 ? "" : "ren"}` : ""}
                        {childIds.length > 0 && siblingCount > 0 ? " · " : ""}
                        {siblingCount > 0 ? `${siblingCount} sibling${siblingCount === 1 ? "" : "s"}` : ""}
                      </dd>
                    </>
                  )}
                </dl>
                {claimable ? (
                  <a
                    href={`/s/${shareSlug}/claim/${pid}`}
                    className="mt-2 inline-block rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white"
                    style={{ pointerEvents: "auto" }}
                  >
                    This is me →
                  </a>
                ) : (
                  <div className="mt-1 text-xs" style={{ color: "var(--color-brand-600)" }}>
                    {readOnly ? "tap to center" : "click to center · double-click card opens profile"}
                  </div>
                )}
              </div>
            );
          })()}

        {/* legend / status */}
        <div
          className="absolute bottom-3 left-3 rounded-lg border px-2.5 py-1 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted)" }}
        >
          {Object.keys(graph.persons).length} people
          {graph.truncated ? " · showing a slice around the focus" : ""}
        </div>

        {readOnly ? (
          <div
            className="absolute bottom-3 right-3 rounded-lg border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted)" }}
          >
            Centered on {center.given || center.name}
          </div>
        ) : (
          <a
            href={`/trees/${treeId}/people/${centerId}`}
            className="absolute bottom-3 right-3 rounded-lg border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            Open {center.given || center.name}&apos;s profile →
          </a>
        )}
      </div>

      <style>{`
        .tbtn {
          border: 1px solid var(--border);
          background: var(--card);
          border-radius: 9999px;
          padding: 4px 10px;
          font-size: 14px;
          line-height: 1;
          min-height: 30px;
        }
        .tbtn:hover { background: var(--bg); }
        .tbtn:disabled { opacity: .5; }
      `}</style>
    </div>
  );
}
