"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { personalWorkspaceId } from "@/lib/workspace";
import { generateApiKey, API_SCOPES } from "@/lib/api/keys";
import { newWebhookSecret, emitEvent } from "@/lib/webhooks";
import { EVENT_NAMES, isEventName } from "@/lib/events-catalog";
import { enqueue, QUEUE } from "@/lib/queue";
import { flashOk, flashErr } from "@/lib/flash";

const NEW_KEY_COOKIE = "fc_new_api_key";

async function ownWorkspaceId(): Promise<string> {
  const user = await requireUser();
  return personalWorkspaceId(user.id, user.name ?? user.email);
}

async function assertOwnedKey(workspaceId: string, id: string) {
  const row = await db.apiKey.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!row) throw new Error("API key not found");
}
async function assertOwnedHook(workspaceId: string, id: string) {
  const row = await db.webhookEndpoint.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!row) throw new Error("Webhook not found");
}

export async function createApiKey(formData: FormData) {
  const user = await requireUser();
  const workspaceId = await personalWorkspaceId(user.id, user.name ?? user.email);
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || "Untitled key";
  const scopes = API_SCOPES.filter((s) => formData.get(`scope_${s}`) === "on");
  if (scopes.length === 0) scopes.push("read");

  const { key, prefix, hashedKey } = generateApiKey();
  await db.apiKey.create({
    data: { workspaceId, name, prefix, hashedKey, scopes, createdById: user.id },
  });

  const jar = await cookies();
  jar.set(NEW_KEY_COOKIE, key, { httpOnly: true, sameSite: "strict", maxAge: 120, path: "/developers" });
  await flashOk("API key created — copy it now, it isn't shown again.");
  revalidatePath("/developers");
  redirect("/developers");
}

export async function revokeApiKey(id: string) {
  const workspaceId = await ownWorkspaceId();
  await assertOwnedKey(workspaceId, id);
  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/developers");
}

export async function consumeNewKeyCookie(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(NEW_KEY_COOKIE)?.value ?? null;
  return v;
}

const hookSchema = z.object({
  url: z.string().url().max(500),
  description: z.string().trim().max(200).optional(),
});

export async function createWebhook(formData: FormData) {
  const user = await requireUser();
  const workspaceId = await personalWorkspaceId(user.id, user.name ?? user.email);
  const parsed = hookSchema.safeParse({
    url: formData.get("url"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    await flashErr("Enter a valid https URL.");
    redirect("/developers");
  }

  const all = formData.get("allEvents") === "on";
  const picked = EVENT_NAMES.filter((e) => formData.get(`ev_${e}`) === "on");
  const events = all || picked.length === 0 ? ["*"] : picked;

  await db.webhookEndpoint.create({
    data: {
      workspaceId,
      url: parsed.data.url,
      description: parsed.data.description ?? null,
      secret: newWebhookSecret(),
      events,
      createdById: user.id,
    },
  });
  await flashOk("Webhook endpoint added.");
  revalidatePath("/developers");
  redirect("/developers");
}

export async function setWebhookActive(id: string, active: boolean) {
  const workspaceId = await ownWorkspaceId();
  await assertOwnedHook(workspaceId, id);
  await db.webhookEndpoint.update({
    where: { id },
    data: { active, ...(active ? { failureCount: 0 } : {}) },
  });
  revalidatePath("/developers");
}

export async function deleteWebhook(id: string) {
  const workspaceId = await ownWorkspaceId();
  await assertOwnedHook(workspaceId, id);
  await db.webhookEndpoint.delete({ where: { id } });
  revalidatePath("/developers");
}

export async function rotateWebhookSecret(id: string) {
  const workspaceId = await ownWorkspaceId();
  await assertOwnedHook(workspaceId, id);
  await db.webhookEndpoint.update({ where: { id }, data: { secret: newWebhookSecret() } });
  revalidatePath("/developers");
}

export async function sendTestEvent(id: string) {
  const workspaceId = await ownWorkspaceId();
  await assertOwnedHook(workspaceId, id);
  const hook = await db.webhookEndpoint.findUniqueOrThrow({ where: { id }, select: { events: true } });
  // deliver a real delivery row so it shows in history, bypassing the catalog gate
  const delivery = await db.webhookDelivery.create({
    data: {
      endpointId: id,
      event: "ping",
      payload: { event: "ping", occurredAt: new Date().toISOString(), workspaceId, data: { message: "Test delivery from Family Compass" } },
    },
    select: { id: true },
  });
  await enqueue(QUEUE.webhookDeliver, { deliveryId: delivery.id }, { retryLimit: 2, retryDelay: 15 });
  void hook;
  revalidatePath("/developers");
}

/** Used by the docs "try it" note only — emits a harmless event to all hooks. */
export async function emitDemoEvent() {
  const workspaceId = await ownWorkspaceId();
  await emitEvent(workspaceId, isEventName("person.updated") ? "person.updated" : "person.created", {
    demo: true,
  });
  revalidatePath("/developers");
}
