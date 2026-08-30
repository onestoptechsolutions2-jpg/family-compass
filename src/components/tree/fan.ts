import { arc as d3arc } from "d3-shape";

import type { TreeGraph } from "@/lib/queries/graph";

export const FAN_INNER_R = 46;
export const FAN_RING_W = 62;
const FAN_SPREAD = (300 * Math.PI) / 180; // 300° fan, gap at the bottom

type ArcDatum = {
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  padAngle?: number;
};

const arcGen = d3arc<ArcDatum>();

export type FanSegment = {
  key: string;
  personId: string;
  generation: number;
  innerRadius: number;
  outerRadius: number;
  d: string;
  labelX: number;
  labelY: number;
  labelAngleDeg: number;
};

export function computeFan(
  graph: TreeGraph,
  centerId: string,
  maxGen: number,
): { segments: FanSegment[]; radius: number } {
  const segments: FanSegment[] = [];

  const place = (id: string, gen: number, start: number, end: number, keyPrefix: string) => {
    if (!graph.persons[id] || gen > maxGen) return;
    const key = `${keyPrefix}${id}`;

    if (gen === 0) {
      segments.push({
        key,
        personId: id,
        generation: 0,
        innerRadius: 0,
        outerRadius: FAN_INNER_R,
        d: arcGen({ innerRadius: 0, outerRadius: FAN_INNER_R, startAngle: 0, endAngle: Math.PI * 2 }) ?? "",
        labelX: 0,
        labelY: 0,
        labelAngleDeg: 0,
      });
    } else {
      const innerRadius = FAN_INNER_R + (gen - 1) * FAN_RING_W;
      const outerRadius = FAN_INNER_R + gen * FAN_RING_W;
      const mid = (start + end) / 2;
      const lr = (innerRadius + outerRadius) / 2;
      let deg = (mid * 180) / Math.PI;
      if (deg > 90) deg -= 180;
      if (deg < -90) deg += 180;
      segments.push({
        key,
        personId: id,
        generation: gen,
        innerRadius,
        outerRadius,
        d: arcGen({ innerRadius, outerRadius, startAngle: start, endAngle: end, padAngle: 0.006 }) ?? "",
        labelX: Math.sin(mid) * lr,
        labelY: -Math.cos(mid) * lr,
        labelAngleDeg: deg,
      });
    }

    if (gen >= maxGen) return;
    const parents = graph.up[id] ?? [];
    const mid = (start + end) / 2;
    if (parents[0]) place(parents[0], gen + 1, start, mid, `${key}/`);
    if (parents[1]) place(parents[1], gen + 1, mid, end, `${key}/`);
  };

  place(centerId, 0, -FAN_SPREAD / 2, FAN_SPREAD / 2, "");
  return { segments, radius: FAN_INNER_R + maxGen * FAN_RING_W };
}
