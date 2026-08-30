import type { Job } from "pg-boss";

import { db } from "@/lib/db";
import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import {
  signWebhookBody,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/lib/webhooks";
import { notifyWorkspaceOwners } from "@/lib/notify";

type Payload = JobPayloads[typeof QUEUE.webhookDeliver];

const TIMEOUT_MS = 10_000;
const DISABLE_AFTER_FAILURES = 15;

export async function handleWebhookDeliver(jobs: Job<Payload>[]) {
  for (const job of jobs) {
    await deliverOne(job.data.deliveryId).catch((err) => {
      // rethrow so pg-boss retries with backoff
      throw err;
    });
  }
}

async function deliverOne(deliveryId: string) {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, event: true, payload: true, attempts: true, endpoint: true },
  });
  if (!delivery) return;
  const ep = delivery.endpoint;
  if (!ep || !ep.active) {
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", error: "endpoint inactive" },
    });
    return;
  }

  const body = JSON.stringify(delivery.payload);
  const attempt = delivery.attempts + 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "FamilyCompass-Webhook/1",
        [WEBHOOK_EVENT_HEADER]: delivery.event,
        [WEBHOOK_DELIVERY_HEADER]: delivery.id,
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookBody(ep.secret, body),
      },
      body,
    });
    statusCode = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }

  const ok = statusCode != null && statusCode >= 200 && statusCode < 300;

  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts: attempt,
      statusCode: statusCode ?? undefined,
      status: ok ? "SUCCESS" : "FAILED",
      error: ok ? null : error,
      deliveredAt: ok ? new Date() : undefined,
    },
  });

  if (ok) {
    await db.webhookEndpoint.update({
      where: { id: ep.id },
      data: { failureCount: 0, lastStatus: statusCode ?? undefined, lastDeliveryAt: new Date() },
    });
    console.log(`[webhook] ${delivery.event} → ${ep.url} ${statusCode}`);
    return;
  }

  const failureCount = ep.failureCount + 1;
  const disable = failureCount >= DISABLE_AFTER_FAILURES;
  await db.webhookEndpoint.update({
    where: { id: ep.id },
    data: {
      failureCount,
      lastStatus: statusCode ?? undefined,
      lastDeliveryAt: new Date(),
      active: disable ? false : undefined,
    },
  });
  if (disable) {
    await notifyWorkspaceOwners(ep.workspaceId, {
      kind: "webhook.disabled",
      title: "A webhook was disabled",
      body: `${ep.url} failed ${failureCount} times in a row and was turned off. Re-enable it in Developers once the endpoint is healthy.`,
      linkPath: "/developers",
    });
  }
  console.warn(`[webhook] ${delivery.event} → ${ep.url} failed (attempt ${attempt}): ${error}`);
  throw new Error(`webhook delivery failed: ${error}`);
}
