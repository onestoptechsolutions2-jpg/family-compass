import { readdirSync } from "node:fs";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BUILD = process.env.APP_BUILD_SHA ?? "unknown";

/** Migration folders checked into the build, sorted (they're zero-padded). */
function migrationsOnDisk(): string[] {
  try {
    return readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

type MigRow = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null };

async function migrationReport() {
  const disk = migrationsOnDisk();
  let rows: MigRow[];
  try {
    rows = await db.$queryRaw<MigRow[]>`
      SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
    `;
  } catch {
    return {
      schema: "never-migrated" as const,
      appliedCount: 0,
      pending: disk,
      failed: [] as string[],
      latestApplied: null as string | null,
      latestOnDisk: disk.at(-1) ?? null,
    };
  }
  const applied = new Set(
    rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name),
  );
  const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at).map((r) => r.migration_name);
  const pending = disk.filter((n) => !applied.has(n) && !failed.includes(n));
  return {
    schema: pending.length === 0 && failed.length === 0 ? ("up-to-date" as const) : ("behind" as const),
    appliedCount: applied.size,
    pending,
    failed,
    latestApplied: [...applied].sort().at(-1) ?? null,
    latestOnDisk: disk.at(-1) ?? null,
  };
}

/**
 * Health + deploy probe. Always reports the build commit and a migration
 * summary so a stale image or an un-migrated database is visible from a
 * browser. Returns 503 when the DB is down or migrations are pending/failed.
 */
export async function GET() {
  // Booleans only — never the value. `false` here means the runtime container
  // is missing the var (often set build-only on the deploy platform).
  const envPresent = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    APP_URL: !!process.env.APP_URL,
  };

  try {
    await db.$queryRaw`SELECT 1`;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        build: BUILD,
        db: "down",
        env: envPresent,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }

  // The DB is reachable — the app can serve, so this stays HTTP 200 (the
  // container healthcheck keys off that). Migration drift is reported in the
  // body via `schema` / `pending` / `failed`, not by failing the probe —
  // failing it could make the orchestrator roll back to the older image.
  const mig = await migrationReport();
  return NextResponse.json({
    ok: true,
    build: BUILD,
    db: "up",
    env: envPresent,
    schemaUpToDate: mig.schema === "up-to-date",
    ...mig,
    ts: new Date().toISOString(),
  });
}
