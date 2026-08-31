"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { getSystemStats, systemAlerts } from "@/lib/system-stats";
import { notifyPlatformAdmins } from "@/lib/notify";
import { env } from "@/lib/env";

const PATH = "/admin/system";

async function done(action: string, meta: Record<string, unknown>, actorId: string) {
  await writeAudit({ actorId, action, targetType: "maintenance", meta });
  revalidatePath(PATH);
}

/** Delete notifications that are read and older than `days`. */
export async function purgeReadNotifications(days: number) {
  const me = await requirePlatformAdmin();
  const cutoff = new Date(Date.now() - days * 864e5);
  const r = await db.notification.deleteMany({
    where: { readAt: { not: null, lt: cutoff } },
  });
  await done("maintenance.notifications.purge", { days, deleted: r.count }, me.id);
}

/** Trim the per-tree activity feed to the last `days`. */
export async function purgeOldActivity(days: number) {
  const me = await requirePlatformAdmin();
  const cutoff = new Date(Date.now() - days * 864e5);
  const r = await db.activityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await done("maintenance.activity.purge", { days, deleted: r.count }, me.id);
}

/** Remove expired auth sessions. */
export async function purgeExpiredSessions() {
  const me = await requirePlatformAdmin();
  const r = await db.session.deleteMany({ where: { expires: { lt: new Date() } } });
  await done("maintenance.sessions.purge", { deleted: r.count }, me.id);
}

/** Remove used / revoked claim invites older than 30 days. */
export async function purgeStaleClaimInvites() {
  const me = await requirePlatformAdmin();
  const cutoff = new Date(Date.now() - 30 * 864e5);
  const r = await db.claimInvite.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ usedAt: { not: null } }, { revokedAt: { not: null } }],
    },
  });
  await done("maintenance.claiminvites.purge", { deleted: r.count }, me.id);
}

/** Delete media rows nothing points at (no refs, not a memorial cover, not a
 *  generation preview/output). Reports bytes reclaimed. */
export async function purgeOrphanMedia() {
  const me = await requirePlatformAdmin();
  const orphans = await db.mediaObject.findMany({
    where: {
      refs: { none: {} },
      noteRefs: { none: {} },
      memorialCoverOf: { none: {} },
      previewOfJobs: { none: {} },
      outputOfJobs: { none: {} },
    },
    select: { id: true, byteSize: true },
  });
  const bytes = orphans.reduce((s, m) => s + m.byteSize, 0);
  if (orphans.length > 0) {
    await db.mediaObject.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }
  await done("maintenance.media.purge_orphans", { deleted: orphans.length, bytes }, me.id);
}

/** Archive/remove completed & cancelled pg-boss jobs older than 7 days. */
export async function purgeCompletedJobs() {
  const me = await requirePlatformAdmin();
  let deleted = 0;
  try {
    const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `WITH d AS (DELETE FROM pgboss.job
         WHERE state IN ('completed','cancelled','failed')
           AND COALESCE(completedon, createdon) < now() - interval '7 days'
         RETURNING 1)
       SELECT count(*)::bigint AS n FROM d`,
    );
    deleted = Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error("[maintenance] job purge failed", err);
  }
  await done("maintenance.jobs.purge", { deleted }, me.id);
}

/** Run the health check on demand and notify admins of any breach. */
export async function runHealthCheck() {
  const me = await requirePlatformAdmin();
  const stats = await getSystemStats();
  const alerts = systemAlerts(stats, { dbAlertGB: env.SYSTEM_DB_ALERT_GB });
  if (alerts.length > 0) {
    await notifyPlatformAdmins({
      kind: "system.alert",
      title: `Server health: ${alerts.length} issue${alerts.length === 1 ? "" : "s"}`,
      body: alerts.map((a) => a.message).join(" "),
      linkPath: PATH,
    });
  }
  await writeAudit({
    actorId: me.id,
    action: "system.healthcheck.manual",
    targetType: "system",
    meta: { alerts: alerts.map((a) => a.key), memPct: stats.osInfo.memUsedPct },
  });
  revalidatePath(PATH);
}
