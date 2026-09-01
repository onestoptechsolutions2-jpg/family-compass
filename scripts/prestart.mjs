// Safety net: apply pending migrations before the web server starts, even when
// the container's ENTRYPOINT (docker-entrypoint.sh) is bypassed by a platform
// "start command" override. Runs on `npm start` via the `prestart` hook.
//
// Skipped when RUN_MIGRATIONS=false (set that on the worker service so the two
// containers don't race). Never fails the boot — a migration problem is logged
// and the server still starts (routes that need the new columns degrade; see
// /api/health for the migration report).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.RUN_MIGRATIONS === "false") {
  console.log("[prestart] RUN_MIGRATIONS=false — skipping prisma migrate deploy");
  process.exit(0);
}

// Prisma reads DATABASE_URL from the process env (or a .env file). If it's in
// neither, migrate would fail with a noisy P1012 — say why and move on. This
// almost always means the deploy platform passed DATABASE_URL as a BUILD-only
// variable; it must also be a RUNTIME variable for the container.
if (!process.env.DATABASE_URL && !existsSync(".env")) {
  console.error(
    "[prestart] DATABASE_URL is not set in this process — skipping prisma migrate deploy.\n" +
      "[prestart] Set DATABASE_URL as a RUNTIME env var on the app service (not build-only),\n" +
      "[prestart] then redeploy. The server will still start; /api/health will show pending migrations.",
  );
  process.exit(0);
}

console.log("[prestart] prisma migrate deploy");
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (r.status !== 0) {
  console.error(
    `[prestart] prisma migrate deploy exited ${r.status ?? r.signal} — starting anyway; check /api/health`,
  );
}
process.exit(0);
