import { PgBoss } from "pg-boss";

import { env } from "@/lib/env";
import { QUEUE } from "@/lib/queue";
import { handleImportGramps, handleImportGedcom } from "./jobs/import";
import { handleRenderPreview, handleRenderOutput } from "./jobs/generation";
import { handleSendEmail } from "./jobs/email";
import { handleWebhookDeliver } from "./jobs/webhook";
import { handleAnniversaryScan } from "./jobs/anniversary";
import { handleSystemHealth } from "./jobs/system";
import { handleGenerationGc } from "./jobs/generation";
import { handleKeeperRenewalScan } from "./jobs/keeper-renewal";

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
  await boss.work(QUEUE.webhookDeliver, handleWebhookDeliver);
  await boss.work(QUEUE.anniversaryScan, handleAnniversaryScan);
  await boss.work(QUEUE.systemHealth, handleSystemHealth);
  await boss.work(QUEUE.generationGc, handleGenerationGc);
  await boss.work(QUEUE.keeperRenewalScan, handleKeeperRenewalScan);

  // daily sweep for upcoming birthdays / death & wedding anniversaries
  await boss.schedule(QUEUE.anniversaryScan, "0 6 * * *", {}, { tz: "Africa/Nairobi" });
  // daily server health check → alerts platform admins
  await boss.schedule(QUEUE.systemHealth, "0 7 * * *", {}, { tz: "Africa/Nairobi" });
  // nightly purge of expired generation artifacts
  await boss.schedule(QUEUE.generationGc, "0 3 * * *", {}, { tz: "Africa/Nairobi" });
  // morning sweep for Keeper renewals — reminders + proactive STK prompts for
  // opted-in trees, while people are awake to see the M-Pesa prompt
  await boss.schedule(QUEUE.keeperRenewalScan, "0 8 * * *", {}, { tz: "Africa/Nairobi" });

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
