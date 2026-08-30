"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireTreeManage } from "@/lib/rbac";

export async function setHomePersonFromTree(treeId: string, personId: string) {
  await requireTreeManage(treeId);
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: { id: true },
  });
  if (!person) throw new Error("Person not in this tree");
  await db.tree.update({ where: { id: treeId }, data: { homePersonId: personId } });
  revalidatePath(`/trees/${treeId}`);
}
