import os from "node:os";
import { statfs } from "node:fs/promises";

import { db } from "@/lib/db";

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export type SystemStats = {
  at: string;
  process: {
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    uptimeSec: number;
    nodeVersion: string;
  };
  osInfo: {
    platform: string;
    cpus: number;
    load1: number;
    load5: number;
    load15: number;
    totalMemMB: number;
    freeMemMB: number;
    memUsedPct: number;
    uptimeSec: number;
  };
  disk: { totalGB: number; freeGB: number; usedPct: number } | null;
  dbBytes: number | null;
  dbTables: { name: string; mb: number }[];
  queue: { pending: number; active: number; completed: number; failed: number } | null;
  rows: {
    users: number;
    trees: number;
    people: number;
    mediaBytes: number;
    mediaCount: number;
    notifications: number;
    activity: number;
    sessions: number;
  };
};

const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

export async function getSystemStats(): Promise<SystemStats> {
  const mem = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();
  const [l1, l5, l15] = os.loadavg();

  let disk: SystemStats["disk"] = null;
  try {
    const s = await statfs(process.cwd());
    const totalB = s.blocks * s.bsize;
    const freeB = s.bfree * s.bsize;
    disk = {
      totalGB: round(totalB / GB),
      freeGB: round(freeB / GB),
      usedPct: round(((totalB - freeB) / totalB) * 100),
    };
  } catch {
    /* statfs unavailable */
  }

  let dbBytes: number | null = null;
  let dbTables: { name: string; mb: number }[] = [];
  try {
    const [sz] = await db.$queryRaw<{ bytes: bigint }[]>`
      SELECT pg_database_size(current_database())::bigint AS bytes`;
    dbBytes = num(sz?.bytes);
    const tables = await db.$queryRaw<{ name: string; bytes: bigint }[]>`
      SELECT c.relname AS name, pg_total_relation_size(c.oid)::bigint AS bytes
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 8`;
    dbTables = tables.map((t) => ({ name: t.name, mb: round(num(t.bytes) / MB) }));
  } catch (err) {
    console.error("[system-stats] db size query failed", err);
  }

  let queue: SystemStats["queue"] = null;
  try {
    const rows = await db.$queryRaw<{ state: string; n: bigint }[]>`
      SELECT state, count(*)::bigint AS n FROM pgboss.job GROUP BY state`;
    const by = Object.fromEntries(rows.map((r) => [r.state, num(r.n)]));
    queue = {
      pending: (by.created ?? 0) + (by.retry ?? 0),
      active: by.active ?? 0,
      completed: by.completed ?? 0,
      failed: by.failed ?? 0,
    };
  } catch {
    /* worker never started — no pgboss schema yet */
  }

  const [users, trees, people, media, notifications, activity, sessions] = await Promise.all([
    db.user.count(),
    db.tree.count(),
    db.person.count(),
    db.mediaObject.aggregate({ _sum: { byteSize: true }, _count: true }),
    db.notification.count(),
    db.activityEvent.count(),
    db.session.count(),
  ]);

  return {
    at: new Date().toISOString(),
    process: {
      rssMB: round(mem.rss / MB),
      heapUsedMB: round(mem.heapUsed / MB),
      heapTotalMB: round(mem.heapTotal / MB),
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
    },
    osInfo: {
      platform: `${os.platform()} ${os.release()}`,
      cpus: os.cpus().length,
      load1: round(l1 ?? 0),
      load5: round(l5 ?? 0),
      load15: round(l15 ?? 0),
      totalMemMB: round(total / MB),
      freeMemMB: round(free / MB),
      memUsedPct: round(((total - free) / total) * 100),
      uptimeSec: Math.round(os.uptime()),
    },
    disk,
    dbBytes,
    dbTables,
    queue,
    rows: {
      users,
      trees,
      people,
      mediaBytes: num(media._sum.byteSize),
      mediaCount: media._count,
      notifications,
      activity,
      sessions,
    },
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Threshold checks used by the scheduled health check. */
export function systemAlerts(s: SystemStats, opts: { dbAlertGB: number }): { key: string; message: string }[] {
  const out: { key: string; message: string }[] = [];
  if (s.osInfo.memUsedPct >= 92) {
    out.push({ key: "mem", message: `Server memory at ${s.osInfo.memUsedPct}% (${s.osInfo.freeMemMB} MB free).` });
  }
  if (s.disk && s.disk.usedPct >= 90) {
    out.push({ key: "disk", message: `Disk at ${s.disk.usedPct}% (${s.disk.freeGB} GB free).` });
  }
  if (s.dbBytes && s.dbBytes >= opts.dbAlertGB * GB) {
    out.push({ key: "db", message: `Database is ${round(s.dbBytes / GB)} GB (alert at ${opts.dbAlertGB} GB).` });
  }
  if (s.queue && s.queue.pending >= 500) {
    out.push({ key: "queue", message: `Job queue backlog: ${s.queue.pending} pending.` });
  }
  if (s.queue && s.queue.failed >= 25) {
    out.push({ key: "jobs", message: `${s.queue.failed} failed background jobs.` });
  }
  return out;
}

export { humanBytes } from "@/lib/format";
