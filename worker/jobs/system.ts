import type { Job } from "pg-boss";

import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { env } from "@/lib/env";
import { getSystemStats, systemAlerts } from "@/lib/system-stats";
import { notifyPlatformAdmins } from "@/lib/notify";
import { writeAudit, lastAuditAt } from "@/lib/audit";

type Payload = JobPayloads[typeof QUEUE.systemHealth];

const REALERT_MS = 12 * 60 * 60 * 1000;

/** Scheduled server health check. Notifies platform admins on threshold
 *  breach, at most once per issue per 12h. */
export async function handleSystemHealth(_jobs: Job<Payload>[]) {
  const stats = await getSystemStats();
  const alerts = systemAlerts(stats, { dbAlertGB: env.SYSTEM_DB_ALERT_GB });

  const fresh: typeof alerts = [];
  for (const a of alerts) {
    const last = await lastAuditAt(`system.alert.${a.key}`);
    if (!last || Date.now() - last.getTime() > REALERT_MS) fresh.push(a);
  }

  if (fresh.length > 0) {
    await notifyPlatformAdmins({
      kind: "system.alert",
      title: `Server health: ${fresh.length} issue${fresh.length === 1 ? "" : "s"}`,
      body: fresh.map((a) => a.message).join(" "),
      linkPath: "/admin/system",
    });
    for (const a of fresh) {
      await writeAudit({ action: `system.alert.${a.key}`, targetType: "system", meta: { message: a.message } });
    }
  }

  await writeAudit({
    action: "system.healthcheck",
    targetType: "system",
    meta: {
      memPct: stats.osInfo.memUsedPct,
      diskPct: stats.disk?.usedPct ?? null,
      dbBytes: stats.dbBytes,
      queuePending: stats.queue?.pending ?? null,
      alerts: fresh.map((a) => a.key),
    },
  });

  console.log(`[system-health] mem ${stats.osInfo.memUsedPct}% · ${alerts.length} alert(s), ${fresh.length} new`);
}
