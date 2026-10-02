import type { Job } from "pg-boss";

import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { sweepShop } from "@/lib/maintenance";
import { writeAudit } from "@/lib/audit";

type Payload = JobPayloads[typeof QUEUE.shopMaintenance];

/** Nightly housekeeping for the shop. Records what it removed so a surprise is traceable. */
export async function handleShopMaintenance(_jobs: Job<Payload>[]) {
  const swept = await sweepShop();
  await writeAudit({ action: "shop.maintenance", targetType: "system", meta: swept });
  console.log("[worker] shop maintenance", swept);
}
