import Link from "next/link";

type Part = { key: string; label: string; pct: number };

const RAMP =
  "linear-gradient(90deg, #ef4444 0%, #f97316 28%, #eab308 55%, #84cc16 78%, #22c55e 100%)";

/** The scaled-gradient fill: reaches `v`% wide and ends on the colour for `v`. */
function fillStyle(v: number): React.CSSProperties {
  return {
    width: `${v}%`,
    backgroundImage: RAMP,
    backgroundSize: `${(100 / Math.max(v, 1)) * 100}% 100%`,
    backgroundRepeat: "no-repeat",
  };
}

/** One slim labelled row — used for the per-family breakdown. */
export function EnergyRow({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  href?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const body = (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 truncate text-sm">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <span className="block h-full rounded-full transition-[width] duration-700" style={fillStyle(v)} />
      </span>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums" style={{ color: "var(--muted)" }}>
        {v}
        {sub ? ` · ${sub}` : ""}
      </span>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-md px-1 py-1 hover:bg-[var(--surface-2)]">
      {body}
    </Link>
  ) : (
    <div className="px-1 py-1">{body}</div>
  );
}

/**
 * "Family energy" meter. A single gradient-filled bar whose fill both reaches
 * `value`% wide AND ends on the colour for that score — the gradient
 * (red → amber → green) is scaled so 0–value maps onto the whole ramp, so a
 * low score shows only the warm end and a full score shows the whole sweep.
 */
export function EnergyBar({
  value,
  parts,
  label = "Family energy",
}: {
  value: number;
  parts?: Part[];
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone = v >= 75 ? "thriving" : v >= 50 ? "healthy" : v >= 25 ? "sparse" : "just starting";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{label}</h3>
        <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>
          <span className="text-lg font-semibold" style={{ color: "var(--fg)" }}>{v}</span> / 100 · {tone}
        </span>
      </div>

      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-2)" }}
        role="meter"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full transition-[width] duration-700" style={fillStyle(v)} />
      </div>

      {parts && parts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    p.pct >= 66 ? "#22c55e" : p.pct >= 33 ? "#eab308" : "#ef4444",
                }}
              />
              {p.label} <span className="tabular-nums">{p.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
