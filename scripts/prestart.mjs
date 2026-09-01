// Safety net: apply pending migrations before the web server starts, even when
// the container's ENTRYPOINT (docker-entrypoint.sh) is bypassed by a platform
// "start command" override. Runs on `npm start` via the `prestart` hook.
//
// Skipped when RUN_MIGRATIONS=false (set that on the worker service so the two
// containers don't race). Never fails the boot — a migration problem is logged
// and the server still starts (routes that need the new columns degrade; see
// /api/health for the migration report).
import { spawnSync } from "node:child_process";

if (process.env.RUN_MIGRATIONS === "false") {
  console.log("[prestart] RUN_MIGRATIONS=false — skipping prisma migrate deploy");
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
