import type { Job } from "pg-boss";

import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { createBackup } from "@/lib/backup";

type Payload = JobPayloads[typeof QUEUE.backupScheduled];

/** Nightly pg_dump into BACKUP_DIR — see docs on src/lib/backup.ts. Every
 *  run (success or failure) is written to the AuditLog, which is what the
 *  admin System page's backup status reads from. */
export async function handleBackupScheduled(_jobs: Job<Payload>[]) {
  const result = await createBackup("scheduled", null);
  if (result.ok) {
    console.log(`[backup] scheduled backup written: ${result.name}`);
  } else {
    console.error(`[backup] scheduled backup failed: ${result.error}`);
  }
}
