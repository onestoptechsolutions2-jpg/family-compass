import { PgBoss } from "pg-boss";

import { env } from "@/lib/env";
import { QUEUE } from "@/lib/queue";
import { handleImportGramps, handleImportGedcom } from "./jobs/import";
import { handleRenderPreview, handleRenderOutput } from "./jobs/generation";
import { handleSendEmail } from "./jobs/email";

async function main() {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: "pgboss",
    max: 10,
  });

  boss.on("error", (err: unknown) => console.error("[worker] pg-boss error", err));

  await boss.start();
  for (const name of Object.values(QUEUE)) {
    await boss.createQueue(name);
  }

  await boss.work(QUEUE.importGramps, handleImportGramps);
  await boss.work(QUEUE.importGedcom, handleImportGedcom);
  await boss.work(QUEUE.renderPreview, handleRenderPreview);
  await boss.work(QUEUE.renderOutput, handleRenderOutput);
  await boss.work(QUEUE.sendEmail, handleSendEmail);

  console.log("[worker] ready — listening on", Object.values(QUEUE).join(", "));

  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} received, stopping…`);
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
