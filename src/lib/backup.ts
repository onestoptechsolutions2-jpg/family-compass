import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile, copyFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

import { env } from "@/lib/env";
import { signS3 } from "@/lib/s3-sign";
import { writeAudit, lastAuditAt } from "@/lib/audit";

export type BackupFile = { name: string; sizeBytes: number; createdAt: Date };
export type BackupKind = "scheduled" | "manual";
export type RestoreResult = { ok: boolean; error?: string; safetyBackupName?: string };

async function ensureDir(): Promise<void> {
  await mkdir(env.BACKUP_DIR, { recursive: true });
}

function secondaryEnabled(): boolean {
  return env.BACKUP_DIR_SECONDARY.trim().length > 0;
}

/** Best-effort mirror to the secondary location — never lets a copy failure
 *  there fail the primary backup, which already succeeded on disk. */
async function copyToSecondary(name: string, actorId?: string | null): Promise<void> {
  if (!secondaryEnabled()) return;
  try {
    await mkdir(env.BACKUP_DIR_SECONDARY, { recursive: true });
    await copyFile(path.join(env.BACKUP_DIR, name), path.join(env.BACKUP_DIR_SECONDARY, name));
  } catch (e) {
    await writeAudit({
      actorId,
      action: "backup.secondary_failed",
      targetType: "system",
      meta: { name, error: (e as Error).message },
    });
  }
}

/** Off-server copies are on once a bucket, its endpoint and keys are all set. */
export function offsiteEnabled(): boolean {
  return Boolean(env.BACKUP_S3_ENDPOINT && env.BACKUP_S3_BUCKET && env.BACKUP_S3_ACCESS_KEY_ID && env.BACKUP_S3_SECRET_ACCESS_KEY);
}

/** Where a backup lives in the bucket (path-style, which every S3-compatible store accepts). */
function offsiteUrl(name: string): string {
  const prefix = env.BACKUP_S3_PREFIX.replace(/^\/+/, "");
  return `${env.BACKUP_S3_ENDPOINT.replace(/\/+$/, "")}/${env.BACKUP_S3_BUCKET}/${prefix}${name}`;
}

/**
 * Upload a backup off this server, streamed so a large dump never sits in memory. Tried three
 * times; a failure is audited (and shown on the System page) but never fails the backup itself,
 * which is already safe on disk.
 */
async function copyOffsite(name: string, actorId?: string | null): Promise<void> {
  if (!offsiteEnabled()) return;
  const file = path.join(env.BACKUP_DIR, name);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { size } = await stat(file);
      const url = offsiteUrl(name);
      const headers = signS3({
        method: "PUT",
        url,
        region: env.BACKUP_S3_REGION || "auto",
        accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
        secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
        payloadHash: "UNSIGNED-PAYLOAD",
        headers: { "content-type": "application/octet-stream", "content-length": String(size) },
      });
      const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
      const res = await fetch(url, { method: "PUT", headers, body, duplex: "half" } as RequestInit & { duplex: "half" });
      if (res.ok) {
        await writeAudit({ actorId, action: "backup.offsite_copied", targetType: "system", meta: { name, sizeBytes: size } });
        return;
      }
      lastError = `${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`;
    } catch (e) {
      lastError = (e as Error).message;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 5000));
  }
  await writeAudit({ actorId, action: "backup.offsite_failed", targetType: "system", meta: { name, error: lastError } });
}

async function pruneSecondary(keepNames: Set<string>): Promise<void> {
  if (!secondaryEnabled()) return;
  const names = await readdir(env.BACKUP_DIR_SECONDARY).catch(() => [] as string[]);
  for (const name of names) {
    if (name.endsWith(".dump") && !keepNames.has(name)) {
      await unlink(path.join(env.BACKUP_DIR_SECONDARY, name)).catch(() => {});
    }
  }
}

/** Settings only Prisma understands; pg_dump and pg_restore refuse a URL that carries them. */
const PRISMA_ONLY = ["schema", "connection_limit", "pool_timeout", "pgbouncer", "statement_cache_size", "socket_timeout"];

/** The database URL as pg_dump/pg_restore accept it: "?schema=public" and the like taken off. */
export function libpqUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of PRISMA_ONLY) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
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
  const keep = files.slice(0, env.BACKUP_RETENTION);
  for (const f of files.slice(env.BACKUP_RETENTION)) {
    await unlink(path.join(env.BACKUP_DIR, f.name)).catch(() => {});
  }
  await pruneSecondary(new Set(keep.map((f) => f.name)));
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
    libpqUrl(env.DATABASE_URL),
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

  await copyToSecondary(name, actorId);
  await copyOffsite(name, actorId);
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
    libpqUrl(env.DATABASE_URL),
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
  if (secondaryEnabled()) {
    await unlink(path.join(env.BACKUP_DIR_SECONDARY, safeName(name))).catch(() => {});
  }
}

export type BackupStatus = {
  dir: string;
  retention: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  secondaryDir: string | null;
  secondaryLastFailureAt: Date | null;
  /** the bucket off this server, or null when it is not set up */
  offsite: string | null;
  offsiteLastCopyAt: Date | null;
  offsiteLastFailureAt: Date | null;
};

export async function backupStatus(): Promise<BackupStatus> {
  const [lastSuccessAt, lastFailureAt, secondaryLastFailureAt, offsiteLastCopyAt, offsiteLastFailureAt] = await Promise.all([
    lastAuditAt("backup.created"),
    lastAuditAt("backup.failed"),
    secondaryEnabled() ? lastAuditAt("backup.secondary_failed") : Promise.resolve(null),
    offsiteEnabled() ? lastAuditAt("backup.offsite_copied") : Promise.resolve(null),
    offsiteEnabled() ? lastAuditAt("backup.offsite_failed") : Promise.resolve(null),
  ]);
  return {
    dir: env.BACKUP_DIR,
    retention: env.BACKUP_RETENTION,
    lastSuccessAt,
    lastFailureAt,
    secondaryDir: secondaryEnabled() ? env.BACKUP_DIR_SECONDARY : null,
    secondaryLastFailureAt,
    offsite: offsiteEnabled() ? `${env.BACKUP_S3_BUCKET}/${env.BACKUP_S3_PREFIX}` : null,
    offsiteLastCopyAt,
    offsiteLastFailureAt,
  };
}
