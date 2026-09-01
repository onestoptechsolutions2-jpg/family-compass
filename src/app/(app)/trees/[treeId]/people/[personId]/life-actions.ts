"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { loadTreeContext, canEdit } from "@/lib/rbac";
import { flashOk, flashErr } from "@/lib/flash";
import { logActivity } from "@/lib/activity";
import { emitTreeEvent } from "@/lib/webhooks";
import { notifyTreeManagers } from "@/lib/notify";
import { addLifeUpdate, endLifeUpdate, lifeCategoryMeta } from "@/lib/life";

const back = (treeId: string, personId: string) =>
  `/trees/${treeId}/people/${personId}#tab=life`;

/** Editors, or the person themselves, may post. */
async function mayPost(treeId: string, personId: string) {
  const ctx = await loadTreeContext(treeId);
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: { claimedByUserId: true },
  });
  if (!person) throw new Error("Person not found");
  const own = person.claimedByUserId === ctx.user.id;
  if (!canEdit(ctx.role) && !own) throw new Error("You can't post updates on this profile");
  return { ctx, own };
}

export async function addLifeUpdateAction(treeId: string, personId: string, formData: FormData) {
  const { ctx } = await mayPost(treeId, personId);
  const category = String(formData.get("category") ?? "other");

  let id: string;
  try {
    id = await addLifeUpdate({
      treeId,
      personId,
      category,
      body: String(formData.get("body") ?? ""),
      current: formData.get("current") === "on",
      since: String(formData.get("since") ?? ""),
      createdById: ctx.user.id,
    });
  } catch (e) {
    await flashErr(e instanceof Error ? e.message : "Couldn't post that.");
    redirect(back(treeId, personId));
  }

  const meta = lifeCategoryMeta(category);
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "posted",
    objectType: "person",
    objectId: personId,
    summary: `posted a ${meta.label.toLowerCase()} life update`,
  });
  await emitTreeEvent(treeId, "person.life_update", { personId, updateId: id, category });

  // milestones are worth an actual ping; the rest just live in the reel
  if (category === "milestone") {
    await notifyTreeManagers(
      treeId,
      {
        kind: "person.life_update",
        title: "A family milestone",
        body: String(formData.get("body") ?? "").slice(0, 160),
        linkPath: back(treeId, personId),
      },
      { exceptUserId: ctx.user.id },
    );
  }

  await flashOk("Update posted.");
  revalidatePath(`/trees/${treeId}/people/${personId}`);
  redirect(back(treeId, personId));
}

export async function endLifeUpdateAction(treeId: string, personId: string, id: string) {
  await mayPost(treeId, personId);
  await endLifeUpdate(treeId, id);
  revalidatePath(`/trees/${treeId}/people/${personId}`);
  redirect(back(treeId, personId));
}
