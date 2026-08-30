"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { normalizeClan } from "@/lib/clan";

const clanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  aka: z.string().trim().max(200).optional(),
  community: z.string().trim().max(120).optional(),
  totem: z.string().trim().max(120).optional(),
  origin: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export async function createClan(treeId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const d = clanSchema.parse(Object.fromEntries(formData));
  const normalized = normalizeClan(d.name);
  const dupe = await db.clan.findUnique({
    where: { treeId_normalized: { treeId, normalized } },
    select: { id: true },
  });
  if (dupe) throw new Error("That clan already exists in this tree");
  await db.clan.create({
    data: {
      treeId,
      name: d.name,
      normalized,
      aka: d.aka || null,
      community: d.community || null,
      totem: d.totem || null,
      origin: d.origin || null,
      notes: d.notes || null,
    },
  });
  revalidatePath(`/trees/${treeId}/clans`);
}

export async function updateClan(treeId: string, clanId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const d = clanSchema.parse(Object.fromEntries(formData));
  const owned = await db.clan.findFirst({ where: { id: clanId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Clan not found");
  await db.clan.update({
    where: { id: clanId },
    data: {
      name: d.name,
      normalized: normalizeClan(d.name),
      aka: d.aka || null,
      community: d.community || null,
      totem: d.totem || null,
      origin: d.origin || null,
      notes: d.notes || null,
    },
  });
  revalidatePath(`/trees/${treeId}/clans`);
}

export async function deleteClan(treeId: string, clanId: string) {
  await requireTreeEdit(treeId);
  const owned = await db.clan.findFirst({ where: { id: clanId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Clan not found");
  await db.clan.delete({ where: { id: clanId } });
  revalidatePath(`/trees/${treeId}/clans`);
}
