"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { notifyTreeManagers } from "@/lib/notify";
import { CONTRIBUTION_SECTIONS } from "@/lib/memorial-sections";

const SECTION_VALUES = new Set<string>(CONTRIBUTION_SECTIONS.map((s) => s.value));

export async function submitContribution(slug: string, token: string, formData: FormData) {
  const contributor = await db.memorialContributor.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      memorialId: true,
      memorial: { select: { slug: true, treeId: true, personId: true } },
    },
  });
  if (!contributor || contributor.memorial.slug !== slug) redirect(`/m/${slug}`);

  const authorName = String(formData.get("authorName") ?? "").trim().slice(0, 120) || contributor.name;
  const rawSection = String(formData.get("section") ?? "memory");
  const section = SECTION_VALUES.has(rawSection) ? rawSection : "other";
  const body = String(formData.get("body") ?? "").trim().slice(0, 8000);
  if (body.length < 3) redirect(`/m/${slug}/contribute/${token}?err=1`);

  await db.memorialContribution.create({
    data: { memorialId: contributor.memorialId, contributorId: contributor.id, authorName, section, body },
  });

  await notifyTreeManagers(contributor.memorial.treeId, {
    kind: "memorial.contribution",
    title: "New memorial contribution",
    body: `${authorName}: "${body.slice(0, 140)}"`,
    linkPath: `/trees/${contributor.memorial.treeId}/people/${contributor.memorial.personId}/memorial`,
  });

  revalidatePath(`/m/${slug}/contribute/${token}`);
  redirect(`/m/${slug}/contribute/${token}?sent=1`);
}
