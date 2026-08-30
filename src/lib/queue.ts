import { PgBoss, type SendOptions } from "pg-boss";

import { env } from "@/lib/env";

/** Job queue names. Keep in sync with worker/index.ts. */
export const QUEUE = {
  importGramps: "import.gramps",
  importGedcom: "import.gedcom",
  renderPreview: "generation.preview",
  renderOutput: "generation.output",
  sendEmail: "email.send",
  webhookDeliver: "webhook.deliver",
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export type JobPayloads = {
  [QUEUE.importGramps]: { importJobId: string };
  [QUEUE.importGedcom]: { importJobId: string };
  [QUEUE.renderPreview]: { generationJobId: string };
  [QUEUE.renderOutput]: { generationJobId: string };
  [QUEUE.sendEmail]: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  };
  [QUEUE.webhookDeliver]: { deliveryId: string };
};

const globalForBoss = globalThis as unknown as { boss?: PgBoss; bossStarted?: Promise<PgBoss> };

/** Long-lived PgBoss singleton (the app runs as `next start`, not serverless). */
export async function getBoss(): Promise<PgBoss> {
  if (globalForBoss.bossStarted) return globalForBoss.bossStarted;

  globalForBoss.bossStarted = (async () => {
    const boss =
      globalForBoss.boss ??
      new PgBoss({
        connectionString: env.DATABASE_URL,
        schema: "pgboss",
        // Keep the web-side pool tiny; the worker carries the load.
        max: 3,
      });
    globalForBoss.boss = boss;
    boss.on("error", (err: unknown) => console.error("[pg-boss]", err));
    await boss.start();
    for (const name of Object.values(QUEUE)) {
      await boss.createQueue(name);
    }
    return boss;
  })();

  return globalForBoss.bossStarted;
}

export async function enqueue<N extends QueueName>(
  name: N,
  data: JobPayloads[N],
  options?: SendOptions,
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(name, data as object, options ?? {});
}
