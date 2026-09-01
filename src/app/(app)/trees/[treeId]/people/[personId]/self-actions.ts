"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { loadTreeContext } from "@/lib/rbac";
import { flashOk, flashErr } from "@/lib/flash";
import { saveSelfNode } from "@/lib/self-node";

export async function saveSelfNodeAction(treeId: string, personId: string, formData: FormData) {
  const ctx = await loadTreeContext(treeId);
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: { claimedByUserId: true },
  });
  if (!person) throw new Error("Person not found");
  if (person.claimedByUserId !== ctx.user.id) {
    await flashErr("Only you can fill in your own “About me”.");
    redirect(`/trees/${treeId}/people/${personId}#tab=about`);
  }

  await saveSelfNode(personId, ctx.user.id, Object.fromEntries(formData));
  await flashOk("Saved.");
  revalidatePath(`/trees/${treeId}/people/${personId}`);
  redirect(`/trees/${treeId}/people/${personId}#tab=about`);
}
