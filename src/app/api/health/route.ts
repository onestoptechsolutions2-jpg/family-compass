import { readdirSync } from "node:fs";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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

/**
 * Health probe. `?schema=1` adds a migration-readiness report — which
 * migrations in the image have actually been applied to the connected
 * database, and which are pending or failed. Handy when a deploy hasn't run
 * `prisma migrate deploy` and tree pages start 500ing on missing columns.
 */
export async function GET(req: Request) {
  const wantSchema = new URL(req.url).searchParams.get("schema") === "1";
  try {
    await db.$queryRaw`SELECT 1`;
    if (!wantSchema) {
      return NextResponse.json({ ok: true, db: "up", ts: new Date().toISOString() });
    }

    const disk = migrationsOnDisk();
    let rows: MigRow[] = [];
    try {
      rows = await db.$queryRaw<MigRow[]>`
        SELECT migration_name, finished_at, rolled_back_at
        FROM _prisma_migrations
      `;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          db: "up",
          schema: "unknown",
          error: "_prisma_migrations table not found — migrations have never run on this database",
          onDisk: disk,
        },
        { status: 503 },
      );
    }

    const applied = new Set(
      rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name),
    );
    const failed = rows
      .filter((r) => !r.finished_at && !r.rolled_back_at)
      .map((r) => r.migration_name);
    const pending = disk.filter((name) => !applied.has(name) && !failed.includes(name));
    const healthy = pending.length === 0 && failed.length === 0;

    return NextResponse.json(
      {
        ok: healthy,
        db: "up",
        schema: healthy ? "up-to-date" : "behind",
        appliedCount: applied.size,
        pending,
        failed,
        latestApplied: [...applied].sort().at(-1) ?? null,
        latestOnDisk: disk.at(-1) ?? null,
        ts: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
