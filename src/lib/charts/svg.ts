import type { TreeGraph } from "@/lib/queries/graph";
import { CARD_W, CARD_H, computeLayout, linkPath, type Mode } from "@/components/tree/layout";
import { computeFan } from "@/components/tree/fan";

const COLORS = {
  bg: "#ffffff",
  ink: "#1e2330",
  muted: "#6b7280",
  border: "#d8d2c4",
  center: "#4f46e5",
  male: "#6366f1",
  female: "#db2777",
  other: "#64748b",
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function initials(given: string, surname: string) {
  return ((given[0] ?? "") + (surname[0] ?? "")).toUpperCase() || "?";
}

const wmDefs = `
  <pattern id="wm" width="320" height="220" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
    <text x="0" y="120" font-family="sans-serif" font-size="34" fill="#111" fill-opacity="0.06">Family Compass · PREVIEW</text>
  </pattern>`;

type Opts = { watermark?: boolean; title?: string };

export function chartSvg(
  graph: TreeGraph,
  centralId: string,
  kind: "PEDIGREE_PDF" | "DESCENDANT_CHART" | "FAN_CHART",
  gens: number,
  opts: Opts = {},
): { svg: string; width: number; height: number } {
  const pad = 48;
  let inner = "";
  let minX: number, minY: number, w: number, h: number;

  if (kind === "FAN_CHART") {
    const { segments, radius } = computeFan(graph, centralId, Math.min(gens + 1, 7));
    const R = radius + pad;
    minX = -R;
    minY = -R;
    w = R * 2;
    h = R * 2;
    inner = segments
      .map((s) => {
        const p = graph.persons[s.personId];
        if (!p) return "";
        const fill =
          s.generation === 0
            ? COLORS.center
            : p.gender === "MALE"
              ? "#c7d2fe"
              : p.gender === "FEMALE"
                ? "#fbcfe8"
                : "#e2e8f0";
        const label =
          s.generation === 0
            ? `<text text-anchor="middle" y="4" font-size="11" font-weight="700" fill="#fff">${esc(initials(p.given, p.surname))}</text>`
            : s.generation <= 4
              ? `<text transform="translate(${s.labelX.toFixed(1)},${s.labelY.toFixed(1)}) rotate(${s.labelAngleDeg.toFixed(1)})" text-anchor="middle" font-size="${s.generation <= 2 ? 10 : 8}" fill="#1e293b">${esc((p.given || p.surname || p.name).slice(0, s.generation <= 2 ? 14 : 9))}</text>`
              : "";
        return `<path d="${s.d}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>${label}`;
      })
      .join("");
  } else {
    const mode: Mode = kind === "PEDIGREE_PDF" ? "ancestors" : "descendants";
    const layout = computeLayout(graph, centralId, mode, gens);
    minX = layout.bounds.minX - pad;
    minY = layout.bounds.minY - pad;
    w = layout.bounds.maxX - layout.bounds.minX + pad * 2;
    h = layout.bounds.maxY - layout.bounds.minY + pad * 2;

    const edges = layout.edges
      .map(
        (e) =>
          `<path d="${linkPath(e)}" fill="none" stroke="${e.kind === "couple" ? COLORS.center : COLORS.border}" stroke-width="${e.kind === "couple" ? 2 : 1.6}"${e.kind === "couple" ? ' stroke-dasharray="4 4"' : ""}/>`,
      )
      .join("");

    const nodes = layout.nodes
      .map((n) => {
        const p = graph.persons[n.personId];
        if (!p) return "";
        const isCenter = n.role === "center";
        const ch = isCenter ? CARD_H + 8 : CARD_H;
        const x = n.x - CARD_W / 2;
        const y = n.y - ch / 2;
        const disc = p.gender === "MALE" ? COLORS.male : p.gender === "FEMALE" ? COLORS.female : COLORS.other;
        const dates = [p.birthYear, p.deathYear].some(Boolean)
          ? `${p.birthYear ?? "?"} – ${p.deathYear ?? (p.living ? "" : "?")}`
          : p.living
            ? "living"
            : "";
        return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
          <rect width="${CARD_W}" height="${ch}" rx="14" fill="#fff" stroke="${isCenter ? COLORS.center : COLORS.border}" stroke-width="${isCenter ? 2.5 : 1}"/>
          <circle cx="26" cy="${ch / 2}" r="17" fill="${disc}"/>
          <text x="26" y="${ch / 2 + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${esc(initials(p.given, p.surname))}</text>
          <text x="52" y="${ch / 2 - 4}" font-size="13" font-weight="600" fill="${COLORS.ink}">${p.deceased ? `<tspan fill="${COLORS.border}">† </tspan>` : ""}${esc(p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name)}</text>
          <text x="52" y="${ch / 2 + 14}" font-size="11" fill="${COLORS.muted}">${esc(dates)}</text>
        </g>`;
      })
      .join("");
    inner = edges + nodes;
  }

  const titleEl = opts.title
    ? `<text x="${(minX + pad).toFixed(0)}" y="${(minY + 30).toFixed(0)}" font-size="20" font-weight="700" fill="${COLORS.ink}" font-family="serif">${esc(opts.title)}</text>`
    : "";
  const wm = opts.watermark
    ? `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="url(#wm)"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" font-family="ui-sans-serif, system-ui, sans-serif">
    <defs>${wmDefs}</defs>
    <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${COLORS.bg}"/>
    ${inner}
    ${titleEl}
    ${wm}
  </svg>`;

  return { svg, width: Math.round(w), height: Math.round(h) };
}
