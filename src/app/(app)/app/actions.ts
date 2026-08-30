"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { slugify, randomToken } from "@/lib/slug";

const createTreeSchema = z.object({
  name: z.string().trim().min(1, "Give the tree a name").max(120),
  workspaceId: z.string().min(1),
});

export async function createTree(formData: FormData) {
  const user = await requireUser();
  const parsed = createTreeSchema.safeParse({
    name: formData.get("name"),
    workspaceId: formData.get("workspaceId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { name, workspaceId } = parsed.data;

  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== Role.OWNER && membership.role !== Role.EDITOR)) {
    throw new Error("You can't create trees in this workspace");
  }

  const base = slugify(name) || "tree";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await db.tree.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
      select: { id: true },
    });
    if (!clash) break;
    slug = `${base}-${randomToken(4)}`;
  }

  const tree = await db.tree.create({
    data: { workspaceId, name, slug },
    select: { id: true },
  });

  revalidatePath("/app");
  redirect(`/trees/${tree.id}`);
}
