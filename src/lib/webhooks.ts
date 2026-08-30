import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { enqueue, QUEUE } from "@/lib/queue";
import { subscriptionMatches, type EventName } from "@/lib/events-catalog";

export const WEBHOOK_SIGNATURE_HEADER = "x-familycompass-signature";
export const WEBHOOK_EVENT_HEADER = "x-familycompass-event";
export const WEBHOOK_DELIVERY_HEADER = "x-familycompass-delivery";

export function newWebhookSecret(): string {
  return "whsec_" + randomBytes(24).toString("hex");
}

/** `sha256=<hex>` HMAC of the raw request body, keyed by the endpoint secret. */
export function signWebhookBody(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function verifyWebhookSignature(secret: string, body: string, header: string | null): boolean {
  if (!header) return false;
  const expected = signWebhookBody(secret, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

type EnvelopeMeta = { treeId?: string | null };

/**
 * Fire a domain event for a workspace. Persists one WebhookDelivery per
 * subscribed active endpoint and enqueues its delivery job. Never throws —
 * event emission must not break the action that triggered it.
 */
export async function emitEvent(
  workspaceId: string,
  event: EventName,
  data: Record<string, unknown>,
  meta: EnvelopeMeta = {},
): Promise<void> {
  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: { workspaceId, active: true },
      select: { id: true, events: true },
    });
    const targets = endpoints.filter((e) => subscriptionMatches(e.events, event));
    if (targets.length === 0) return;

    const occurredAt = new Date().toISOString();
    for (const ep of targets) {
      const payload = {
        event,
        occurredAt,
        workspaceId,
        treeId: meta.treeId ?? null,
        data,
      } as unknown as Prisma.InputJsonObject;
      const delivery = await db.webhookDelivery.create({
        data: { endpointId: ep.id, event, payload },
        select: { id: true },
      });
      await enqueue(
        QUEUE.webhookDeliver,
        { deliveryId: delivery.id },
        { retryLimit: 6, retryDelay: 30, retryBackoff: true },
      );
    }
  } catch (err) {
    console.error("[webhooks] emitEvent failed", event, err);
  }
}
