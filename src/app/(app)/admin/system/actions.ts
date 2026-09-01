"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { getSystemStats, systemAlerts } from "@/lib/system-stats";
import { notifyPlatformAdmins } from "@/lib/notify";
import { purgeExpiredGeneratedFiles } from "@/lib/generation/gc";
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
  const candidates = await db.mediaObject.findMany({
    where: {
      refs: { none: {} },
      noteRefs: { none: {} },
      memorialCoverOf: { none: {} },
      previewOfJobs: { none: {} },
      outputOfJobs: { none: {} },
    },
    select: { id: true, byteSize: true },
  });
  // Contribution photos are held by an id array on MemorialContribution, not a
  // relation — they must not be swept before the family reviews them.
  const held = new Set(
    (await db.memorialContribution.findMany({ select: { photoMediaIds: true } })).flatMap(
      (c) => c.photoMediaIds,
    ),
  );
  const orphans = candidates.filter((m) => !held.has(m.id));
  const bytes = orphans.reduce((s, m) => s + m.byteSize, 0);
  if (orphans.length > 0) {
    await db.mediaObject.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }
  await done("maintenance.media.purge_orphans", { deleted: orphans.length, bytes }, me.id);
}

/** Trim view-analytics events older than `days`. */
export async function purgeOldViewEvents(days: number) {
  const me = await requirePlatformAdmin();
  const cutoff = new Date(Date.now() - days * 864e5);
  const r = await db.viewEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await done("maintenance.views.purge", { days, deleted: r.count }, me.id);
}

/** Delete generation artifacts (previews + clean outputs) past their lifetime. */
export async function purgeExpiredDownloads() {
  const me = await requirePlatformAdmin();
  const n = await purgeExpiredGeneratedFiles();
  await done("maintenance.downloads.purge", { deleted: n }, me.id);
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

/** Put failed pg-boss jobs back in the queue for another attempt. */
export async function retryFailedJobs() {
  const me = await requirePlatformAdmin();
  let requeued = 0;
  try {
    const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `WITH u AS (UPDATE pgboss.job
         SET state = 'created', startedon = NULL, completedon = NULL,
             retrycount = 0, output = NULL
         WHERE state = 'failed'
         RETURNING 1)
       SELECT count(*)::bigint AS n FROM u`,
    );
    requeued = Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error("[jobs] retry failed", err);
  }
  await done("jobs.retry_failed", { requeued }, me.id);
}

/** Re-enqueue a single generation job's render (preview or clean output). */
export async function requeueGeneration(jobId: string) {
  const me = await requirePlatformAdmin();
  const { enqueue, QUEUE } = await import("@/lib/queue");
  const job = await db.generationJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) return;
  const wantsOutput = job.status === "PAID" || job.status === "RENDERING_OUTPUT";
  await db.generationJob.update({
    where: { id: jobId },
    data: { status: wantsOutput ? "PAID" : "QUEUED", error: null },
  });
  await enqueue(wantsOutput ? QUEUE.renderOutput : QUEUE.renderPreview, { generationJobId: jobId });
  await done("jobs.requeue_generation", { jobId, phase: wantsOutput ? "output" : "preview" }, me.id);
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
