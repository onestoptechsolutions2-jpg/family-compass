"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { flashOk, flashErr } from "@/lib/flash";
import { logActivity } from "@/lib/activity";
import { emitTreeEvent } from "@/lib/webhooks";
import { addMemory, assertRelation } from "@/lib/relationships";

const back = (treeId: string, personId: string) =>
  `/trees/${treeId}/people/${personId}#tab=circle`;

/** Every id must be a person in this tree. */
async function assertInTree(treeId: string, ids: string[]): Promise<void> {
  const clean = [...new Set(ids)].filter(Boolean);
  if (clean.length === 0) return;
  const found = await db.person.count({ where: { treeId, id: { in: clean } } });
  if (found !== clean.length) throw new Error("Someone in that list isn't in this tree");
}

/** Record a shared memory: this person plus whoever else was there. */
export async function addMemoryAction(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const others = formData.getAll("others").map(String).filter(Boolean);
  const participantIds = [...new Set([personId, ...others])];

  const title = String(formData.get("title") ?? "");
  let memoryId: string;
  try {
    await assertInTree(treeId, participantIds);
    memoryId = await addMemory({
      treeId,
      title,
      body: String(formData.get("body") ?? ""),
      dateText: String(formData.get("dateText") ?? ""),
      participantIds,
      createdById: ctx.user.id,
    });
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not save the memory.");
    redirect(back(treeId, personId));
  }
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "recorded",
    objectType: "memory",
    objectId: memoryId,
    summary: `added the memory “${title.trim().slice(0, 80)}”`,
  });
  await emitTreeEvent(treeId, "memory.added", { memoryId, participantIds, title: title.trim() });
  await flashOk(others.length ? "Shared memory saved." : "Memory saved.");
  revalidatePath(`/trees/${treeId}/people/${personId}`);
  redirect(back(treeId, personId));
}

/** Name a tie from this person's side, with the story of how it started. */
export async function addToCircleAction(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const toPersonId = String(formData.get("person") ?? "");
  const via = String(formData.get("via") ?? "");
  const role = String(formData.get("role") ?? "friend");
  const originContext = String(formData.get("originContext") ?? "") || null;

  if (!toPersonId) {
    await flashErr("Pick who this is.");
    redirect(back(treeId, personId));
  }

  try {
    await assertInTree(treeId, [toPersonId, via]);
    await assertRelation({
      treeId,
      fromPersonId: personId,
      toPersonId,
      role,
      origin: {
        text: String(formData.get("originText") ?? ""),
        context: originContext,
        viaPersonId: via || null,
        at: String(formData.get("originAt") ?? "") || null,
      },
    });
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Could not add that.");
    redirect(back(treeId, personId));
  }
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "named",
    objectType: "person",
    objectId: personId,
    summary: `named a ${role.replace(/-/g, " ")} in the circle`,
  });
  await emitTreeEvent(treeId, "relation.named", {
    fromPersonId: personId,
    toPersonId,
    role,
    originContext,
  });
  await flashOk("Added to the circle.");
  revalidatePath(`/trees/${treeId}/people/${personId}`);
  redirect(back(treeId, personId));
}
