import { spawn } from "node:child_process";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";
import { writeAudit, lastAuditAt } from "@/lib/audit";

export type BackupFile = { name: string; sizeBytes: number; createdAt: Date };
export type BackupKind = "scheduled" | "manual";
export type RestoreResult = { ok: boolean; error?: string; safetyBackupName?: string };

async function ensureDir(): Promise<void> {
  await mkdir(env.BACKUP_DIR, { recursive: true });
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Bare filename only — every caller that takes a name must validate it with
 *  this before joining it onto BACKUP_DIR, or a crafted name could escape
 *  the directory (`../../etc/passwd`) via path.join. */
function safeName(name: string): string {
  if (!/^[A-Za-z0-9_.-]+\.dump$/.test(name)) throw new Error("Invalid backup file name");
  return name;
}

export function backupPath(name: string): string {
  return path.join(env.BACKUP_DIR, safeName(name));
}

function run(cmd: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.once("error", (e) => resolve({ code: -1, stderr: (e as Error).message }));
    child.once("close", (code) => resolve({ code, stderr }));
  });
}

/** Backup files on disk, newest first. */
export async function listBackups(): Promise<BackupFile[]> {
  await ensureDir();
  const names = (await readdir(env.BACKUP_DIR)).filter((n) => n.endsWith(".dump"));
  const files = await Promise.all(
    names.map(async (name) => {
      const st = await stat(path.join(env.BACKUP_DIR, name));
      return { name, sizeBytes: st.size, createdAt: st.mtime };
    }),
  );
  return files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function pruneOldBackups(): Promise<void> {
  const files = await listBackups();
  for (const f of files.slice(env.BACKUP_RETENTION)) {
    await unlink(path.join(env.BACKUP_DIR, f.name)).catch(() => {});
  }
}

/** Runs pg_dump into BACKUP_DIR, prunes beyond retention, audits the result.
 *  Used both by the nightly worker job and the admin's "run now" button, and
 *  internally as the automatic pre-restore safety snapshot. */
export async function createBackup(
  kind: BackupKind,
  actorId?: string | null,
): Promise<{ ok: boolean; name?: string; error?: string }> {
  await ensureDir();
  const name = `familycompass-${stamp()}.dump`;
  const dest = path.join(env.BACKUP_DIR, name);
  const started = Date.now();

  const { code, stderr } = await run("pg_dump", [
    "--no-owner",
    "--no-privileges",
    "--format=custom",
    "--file",
    dest,
    env.DATABASE_URL,
  ]);
  const durationMs = Date.now() - started;

  if (code !== 0) {
    await writeAudit({
      actorId,
      action: "backup.failed",
      targetType: "system",
      meta: { kind, error: stderr.slice(0, 1000), durationMs },
    });
    return { ok: false, error: stderr || `pg_dump exited ${code}` };
  }

  const st = await stat(dest).catch(() => null);
  await writeAudit({
    actorId,
    action: "backup.created",
    targetType: "system",
    meta: { kind, name, sizeBytes: st?.size ?? null, durationMs },
  });

  await pruneOldBackups();
  return { ok: true, name };
}

/**
 * Restores from a .dump file already on disk at `sourcePath`. ALWAYS takes a
 * fresh backup first as an automatic pre-restore safety net — pg_restore
 * --clean is destructive and there is no other way back once it has run, so
 * refusing to proceed without a snapshot in hand is not optional caution,
 * it's the only undo path available.
 */
export async function restoreFromFile(sourcePath: string, actorId: string): Promise<RestoreResult> {
  const safety = await createBackup("manual", actorId);
  if (!safety.ok) {
    return {
      ok: false,
      error: `Refused to restore — the automatic pre-restore safety backup failed: ${safety.error}`,
    };
  }

  const started = Date.now();
  const { code, stderr } = await run("pg_restore", [
    "--no-owner",
    "--clean",
    "--if-exists",
    "-d",
    env.DATABASE_URL,
    sourcePath,
  ]);
  const durationMs = Date.now() - started;

  if (code !== 0) {
    await writeAudit({
      actorId,
      action: "backup.restore_failed",
      targetType: "system",
      meta: { source: path.basename(sourcePath), error: stderr.slice(0, 2000), durationMs, safetyBackup: safety.name },
    });
    return { ok: false, error: stderr || `pg_restore exited ${code}`, safetyBackupName: safety.name };
  }

  await writeAudit({
    actorId,
    action: "backup.restored",
    targetType: "system",
    meta: { source: path.basename(sourcePath), durationMs, safetyBackup: safety.name },
  });
  return { ok: true, safetyBackupName: safety.name };
}

/** Writes an uploaded file to a temp path under BACKUP_DIR, restores from
 *  it, then removes the temp copy (the automatic safety snapshot from
 *  restoreFromFile is what's kept, not this upload itself). */
export async function restoreFromUpload(file: File, actorId: string): Promise<RestoreResult> {
  await ensureDir();
  const tmpName = `upload-${stamp()}.dump`;
  const tmpPath = path.join(env.BACKUP_DIR, tmpName);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPath, buf);
  try {
    return await restoreFromFile(tmpPath, actorId);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function deleteBackup(name: string): Promise<void> {
  await unlink(backupPath(name));
}

export type BackupStatus = {
  dir: string;
  retention: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
};

export async function backupStatus(): Promise<BackupStatus> {
  const [lastSuccessAt, lastFailureAt] = await Promise.all([
    lastAuditAt("backup.created"),
    lastAuditAt("backup.failed"),
  ]);
  return { dir: env.BACKUP_DIR, retention: env.BACKUP_RETENTION, lastSuccessAt, lastFailureAt };
}
