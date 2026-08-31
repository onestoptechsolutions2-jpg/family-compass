import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type ViewSummary = {
  total: number;
  uniques: number;
  last7: number;
  byRegion: { label: string; n: number }[];
  byCountry: { label: string; n: number }[];
  byDevice: { label: string; n: number }[];
  byReferrer: { label: string; n: number }[];
  byDay: { day: string; n: number }[];
};

const tally = (rows: (string | null)[], limit: number) => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r?.trim() || "unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, n]) => ({ label, n }));
};

async function summarise(where: Prisma.ViewEventWhereInput): Promise<ViewSummary> {
  const since = new Date(Date.now() - 30 * 864e5);
  const rows = await db.viewEvent.findMany({
    where: { ...where, createdAt: { gte: since } },
    select: {
      region: true,
      country: true,
      deviceKind: true,
      referrerHost: true,
      ipHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20000,
  });

  const wk = new Date(Date.now() - 7 * 864e5);
  const byDayMap = new Map<string, number>();
  for (const r of rows) {
    const d = r.createdAt.toISOString().slice(0, 10);
    byDayMap.set(d, (byDayMap.get(d) ?? 0) + 1);
  }

  return {
    total: rows.length,
    uniques: new Set(rows.map((r) => r.ipHash).filter(Boolean)).size,
    last7: rows.filter((r) => r.createdAt >= wk).length,
    byRegion: tally(rows.map((r) => r.region), 8),
    byCountry: tally(rows.map((r) => r.country), 8),
    byDevice: tally(rows.map((r) => r.deviceKind), 4),
    byReferrer: tally(
      rows.map((r) => r.referrerHost).filter((h) => h && h !== "unknown"),
      6,
    ),
    byDay: [...byDayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, n]) => ({ day, n })),
  };
}

/** Reach for one public link. */
export function viewSummary(kind: string, targetId: string): Promise<ViewSummary> {
  return summarise({ kind, targetId });
}

/** Reach across every public link of a tree. */
export function treeViewSummary(treeId: string): Promise<ViewSummary> {
  return summarise({ treeId });
}

export type MiniReach = { views: number; visitors: number; last7: number; topRegion: string | null };

/** Compact per-target reach for a whole kind within a tree, in one query. */
export async function reachByTarget(treeId: string, kind: string): Promise<Map<string, MiniReach>> {
  const since = new Date(Date.now() - 30 * 864e5);
  const wk = new Date(Date.now() - 7 * 864e5);
  const rows = await db.viewEvent.findMany({
    where: { treeId, kind, createdAt: { gte: since } },
    select: { targetId: true, ipHash: true, region: true, createdAt: true },
    take: 20000,
  });

  const acc = new Map<
    string,
    { views: number; last7: number; ips: Set<string>; regions: Map<string, number> }
  >();
  for (const r of rows) {
    let e = acc.get(r.targetId);
    if (!e) {
      e = { views: 0, last7: 0, ips: new Set(), regions: new Map() };
      acc.set(r.targetId, e);
    }
    e.views += 1;
    if (r.createdAt >= wk) e.last7 += 1;
    if (r.ipHash) e.ips.add(r.ipHash);
    const rg = r.region?.trim();
    if (rg) e.regions.set(rg, (e.regions.get(rg) ?? 0) + 1);
  }

  const out = new Map<string, MiniReach>();
  for (const [target, e] of acc) {
    const topRegion = [...e.regions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    out.set(target, { views: e.views, visitors: e.ips.size, last7: e.last7, topRegion });
  }
  return out;
}
