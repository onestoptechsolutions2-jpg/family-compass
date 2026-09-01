import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/rbac";
import { env } from "@/lib/env";
import { getSystemStats, systemAlerts, humanBytes } from "@/lib/system-stats";
import { queueJobs, pendingGenerations, pendingImports } from "@/lib/queries/jobs";
import { listAudit } from "@/lib/audit";
import { activityKind, activityKindMeta } from "@/lib/activity";
import { Tabs } from "@/components/Tabs";
import {
  purgeReadNotifications,
  purgeOldActivity,
  purgeExpiredSessions,
  purgeStaleClaimInvites,
  purgeOrphanMedia,
  purgeCompletedJobs,
  purgeOldViewEvents,
  purgeExpiredDownloads,
  retryFailedJobs,
  requeueGeneration,
  runHealthCheck,
} from "./actions";

export const metadata = { title: "System" };
export const dynamic = "force-dynamic";

const dur = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: warn ? "var(--danger)" : "var(--border)", background: "var(--card)" }}>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={warn ? { color: "var(--danger)" } : undefined}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? "var(--danger)" : "var(--accent)" }} />
    </div>
  );
}

export default async function AdminSystemPage() {
  await requirePlatformAdmin();
  const [s, audit, qJobs, genJobs, impJobs] = await Promise.all([
    getSystemStats(),
    listAudit(120),
    queueJobs(),
    pendingGenerations(),
    pendingImports(),
  ]);
  const alerts = systemAlerts(s, { dbAlertGB: env.SYSTEM_DB_ALERT_GB });
  const failedCount = qJobs?.filter((j) => j.state === "failed").length ?? 0;
  const jobsPending = (qJobs?.length ?? 0) + genJobs.length + impJobs.length;
  const ago = (d: Date) => {
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
  };

  const resources = (
    <>
      {alerts.length > 0 && (
        <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft, var(--surface-2))" }}>
          <p className="font-medium" style={{ color: "var(--danger)" }}>{alerts.length} alert{alerts.length === 1 ? "" : "s"}</p>
          <ul className="mt-1 list-disc pl-5">
            {alerts.map((a) => <li key={a.key}>{a.message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Server memory</div>
          <div className="mt-0.5 text-lg font-semibold" style={s.osInfo.memUsedPct >= 90 ? { color: "var(--danger)" } : undefined}>
            {s.osInfo.memUsedPct}%
          </div>
          <Bar pct={s.osInfo.memUsedPct} />
          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {s.osInfo.freeMemMB} / {s.osInfo.totalMemMB} MB free
          </div>
        </div>
        {s.disk && (
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="text-xs" style={{ color: "var(--muted)" }}>Disk</div>
            <div className="mt-0.5 text-lg font-semibold" style={s.disk.usedPct >= 90 ? { color: "var(--danger)" } : undefined}>{s.disk.usedPct}%</div>
            <Bar pct={s.disk.usedPct} />
            <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{s.disk.freeGB} / {s.disk.totalGB} GB free</div>
          </div>
        )}
        <Stat label="CPU load (1 / 5 / 15m)" value={`${s.osInfo.load1} / ${s.osInfo.load5} / ${s.osInfo.load15}`} sub={`${s.osInfo.cpus} cores`} />
        <Stat label="App process" value={`${s.process.rssMB} MB RSS`} sub={`heap ${s.process.heapUsedMB}/${s.process.heapTotalMB} MB · ${s.process.nodeVersion}`} />
        <Stat label="Uptime" value={dur(s.process.uptimeSec)} sub={`host ${dur(s.osInfo.uptimeSec)} · ${s.osInfo.platform}`} />
        <Stat
          label="Database"
          value={s.dbBytes != null ? humanBytes(s.dbBytes) : "—"}
          sub={s.dbBytes != null ? `alert at ${env.SYSTEM_DB_ALERT_GB} GB` : "size query failed"}
          warn={s.dbBytes != null && s.dbBytes >= env.SYSTEM_DB_ALERT_GB * 1024 ** 3}
        />
        {s.queue && (
          <Stat
            label="Job queue"
            value={`${s.queue.pending} pending`}
            sub={`${s.queue.active} active · ${s.queue.failed} failed · ${s.queue.completed} done`}
            warn={s.queue.pending >= 500 || s.queue.failed >= 25}
          />
        )}
        <Stat label="Media storage" value={humanBytes(s.rows.mediaBytes)} sub={`${s.rows.mediaCount} files`} />
        <Stat label="Generated files" value={humanBytes(s.rows.generatedBytes)} sub={`${s.rows.generatedCount} artifacts · time-limited`} />
        <Stat label="Records" value={`${s.rows.people.toLocaleString()} people`} sub={`${s.rows.users} users · ${s.rows.trees} trees`} />
        <Stat label="Housekeeping" value={`${s.rows.notifications.toLocaleString()} notifications`} sub={`${s.rows.activity.toLocaleString()} activity · ${s.rows.sessions} sessions`} />
        <Stat
          label="App installs"
          value={`${s.rows.installedDevices.toLocaleString()} device${s.rows.installedDevices === 1 ? "" : "s"}`}
          sub={`${s.rows.installUsers} user${s.rows.installUsers === 1 ? "" : "s"} have added it to a home screen`}
        />
      </div>

      {s.dbTables.length > 0 && (
        <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Largest tables</div>
          <ul className="mt-2 flex flex-col gap-1">
            {s.dbTables.map((t) => (
              <li key={t.name} className="flex justify-between">
                <span>{t.name}</span>
                <span style={{ color: "var(--muted)" }}>{t.mb} MB</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={runHealthCheck}>
        <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
          Run health check now
        </button>
        <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
          also runs daily; alerts go to platform admins only
        </span>
      </form>
    </>
  );

  const job = (label: string, help: string, action: () => Promise<void>, danger?: boolean) => (
    <form action={action} className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>{help}</div>
      </div>
      <button
        className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
        style={danger ? { borderColor: "var(--danger)", color: "var(--danger)" } : { borderColor: "var(--border)" }}
      >
        Run
      </button>
    </form>
  );

  const maintenance = (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Each task is logged to the admin activity log. Safe to run any time.
      </p>
      {job("Purge read notifications", "Delete notifications read more than 90 days ago", purgeReadNotifications.bind(null, 90))}
      {job("Trim activity feed", "Keep the last 365 days of per-tree activity", purgeOldActivity.bind(null, 365))}
      {job("Remove expired sessions", "Delete auth sessions past their expiry", purgeExpiredSessions)}
      {job("Clear stale claim links", "Used / revoked claim invites older than 30 days", purgeStaleClaimInvites)}
      {job("Delete orphaned media", "Media rows with no references, cover or export use", purgeOrphanMedia, true)}
      {job("Archive finished jobs", "Completed / failed pg-boss jobs older than 7 days", purgeCompletedJobs)}
      {job("Trim view analytics", "Public-link view events older than 180 days", purgeOldViewEvents.bind(null, 180))}
      {job("Purge expired downloads", "Generation previews / clean outputs past their lifetime (also runs nightly)", purgeExpiredDownloads)}
    </div>
  );

  const jobs = (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span style={{ color: "var(--muted)" }}>
          {jobsPending === 0 ? "Nothing pending." : `${jobsPending} item${jobsPending === 1 ? "" : "s"} outstanding`}
          {failedCount > 0 ? ` · ${failedCount} failed` : ""}
        </span>
        {failedCount > 0 && (
          <form action={retryFailedJobs}>
            <button className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
              Retry {failedCount} failed job{failedCount === 1 ? "" : "s"}
            </button>
          </form>
        )}
      </div>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Worker queue {qJobs === null ? "(worker not started)" : `(${qJobs.length})`}
        </h3>
        <div className="mt-2 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-3 py-1.5 font-medium">Job</th>
                <th className="px-3 py-1.5 font-medium">State</th>
                <th className="px-3 py-1.5 font-medium">Tries</th>
                <th className="px-3 py-1.5 font-medium">Age</th>
                <th className="px-3 py-1.5 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {(qJobs ?? []).map((j) => (
                <tr key={j.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-1.5 font-mono text-xs">{j.name}</td>
                  <td className="px-3 py-1.5" style={{ color: j.state === "failed" ? "var(--danger)" : undefined }}>{j.state}</td>
                  <td className="px-3 py-1.5">{j.retryCount}/{j.retryLimit}</td>
                  <td className="px-3 py-1.5" style={{ color: "var(--muted)" }}>{ago(j.createdOn)}</td>
                  <td className="px-3 py-1.5 text-xs" style={{ color: "var(--muted)" }}>{j.error ?? ""}</td>
                </tr>
              ))}
              {qJobs !== null && qJobs.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-3 text-center" style={{ color: "var(--muted)" }}>Queue clear.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Generations in flight ({genJobs.length})
        </h3>
        <div className="mt-2 flex flex-col gap-2">
          {genJobs.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
              <div>
                <Link href={`/trees/${g.tree.id}/charts`} className="font-medium hover:underline">{g.tree.name}</Link>
                <span style={{ color: "var(--muted)" }}>
                  {" "}· {g.kind} · <span style={{ color: g.status === "FAILED" ? "var(--danger)" : undefined }}>{g.status}</span> · {ago(g.updatedAt)} · {g.requestedBy.name ?? g.requestedBy.email}
                </span>
                {g.error && <div className="text-xs" style={{ color: "var(--danger)" }}>{g.error}</div>}
              </div>
              <form action={requeueGeneration.bind(null, g.id)}>
                <button className="rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>Requeue</button>
              </form>
            </div>
          ))}
          {genJobs.length === 0 && <p style={{ color: "var(--muted)" }}>None.</p>}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Imports ({impJobs.length})
        </h3>
        <div className="mt-2 flex flex-col gap-2">
          {impJobs.map((i) => (
            <div key={i.id} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
              <Link href={`/trees/${i.tree.id}/import`} className="font-medium hover:underline">{i.tree.name}</Link>
              <span style={{ color: "var(--muted)" }}>
                {" "}· {i.kind} · <span style={{ color: i.status === "FAILED" ? "var(--danger)" : undefined }}>{i.status}</span> · {i.fileName} · {ago(i.updatedAt)}
              </span>
              {i.error && <div className="text-xs" style={{ color: "var(--danger)" }}>{i.error}</div>}
            </div>
          ))}
          {impJobs.length === 0 && <p style={{ color: "var(--muted)" }}>None.</p>}
        </div>
      </section>
    </div>
  );

  const backup = (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <div className="font-medium">Download a backup</div>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Streams a <code>pg_dump</code> (custom format). Needs the Postgres client tools in the
          app container; otherwise run the command below from a host that has them.
        </p>
        <a
          href="/api/admin/backup"
          className="mt-2 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Download .dump
        </a>
      </div>
      <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <div className="font-medium">Manual backup / restore</div>
        <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-xs">{`pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL" > backup.dump

# restore into an EMPTY database (destructive):
pg_restore --no-owner --clean --if-exists -d "$DATABASE_URL" backup.dump`}</pre>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Restore is not run from this app — do it from the host, then redeploy. Media is stored in
          the database, so a dump is a complete backup.
        </p>
      </div>
    </div>
  );

  const log = (
    <ul className="flex flex-col text-sm">
      {audit.map((a) => {
        const meta = activityKindMeta(activityKind(a.targetType ?? "system"));
        return (
          <li key={a.id} className="flex items-baseline justify-between gap-3 border-b py-2 last:border-0" style={{ borderColor: "var(--border)" }}>
            <span>
              <span className="mr-1">{meta.emoji}</span>
              <span className="font-medium">{a.action}</span>
              {a.meta && typeof a.meta === "object" ? (
                <span style={{ color: "var(--muted)" }}> · {JSON.stringify(a.meta)}</span>
              ) : null}
              <span style={{ color: "var(--muted)" }}> — {a.actor?.name ?? a.actor?.email ?? "system"}</span>
            </span>
            <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
              {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </span>
          </li>
        );
      })}
      {audit.length === 0 && <li className="py-3" style={{ color: "var(--muted)" }}>No admin activity yet.</li>}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">System</h1>
      <Tabs
        items={[
          { id: "resources", label: "Resources", badge: alerts.length || undefined, panel: resources },
          { id: "jobs", label: "Jobs", badge: failedCount || undefined, panel: jobs },
          { id: "maintenance", label: "Maintenance", panel: maintenance },
          { id: "backup", label: "Backup & restore", panel: backup },
          { id: "log", label: "Admin log", panel: log },
        ]}
      />
    </div>
  );
}
