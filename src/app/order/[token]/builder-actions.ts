"use server";

import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { hitLimit } from "@/lib/api/rate-limit";
import { sanitizeBuilderOptions } from "@/lib/tree-edit";
import type { DraftOptions } from "@/lib/order-shared";

const MAX_JSON = 20_000; // a large family is a few kilobytes; anything bigger is not the builder

/** The draft this link opens, if it is still open and belongs to whoever is asking. */
async function openDraft(token: string) {
  const order = await db.order.findUnique({ where: { guestToken: token }, include: { items: { take: 1 } } });
  const item = order?.items[0];
  if (!order || !item || order.status !== OrderStatus.DRAFT || order.notes?.startsWith("merged:")) return null;
  if (order.userId) {
    const me = await getSessionUser();
    if (order.userId !== me?.id) return null; // a draft that belongs to an account is that person's alone
  }
  return { item };
}

async function save(token: string, json: string): Promise<boolean> {
  if (json.length > MAX_JSON) return false;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return false;
  }
  const draft = await openDraft(token);
  if (!draft) return false;
  const options = sanitizeBuilderOptions(raw, (draft.item.options ?? {}) as DraftOptions);
  await db.orderItem.update({ where: { id: draft.item.id }, data: { options: options as object } });
  return true;
}

/** Saved quietly as they build, so closing the tab loses nothing. */
export async function autosaveBuilder(token: string, json: string): Promise<{ ok: boolean }> {
  if (!hitLimit(`autosave:${token}`, 120, 60)) return { ok: false };
  return { ok: await save(token, json) };
}

/** "Continue": save what is on the tree, then on to the material and size. */
export async function continueBuilder(token: string, formData: FormData) {
  const ok = await save(token, String(formData.get("options") ?? ""));
  if (!ok) redirect(`/order/${token}?step=1`);
  redirect(`/order/${token}?step=2`);
}
