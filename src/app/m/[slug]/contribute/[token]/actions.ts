"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { notifyTreeManagers } from "@/lib/notify";
import { CONTRIBUTION_SECTIONS } from "@/lib/memorial-sections";

const SECTION_VALUES = new Set<string>(CONTRIBUTION_SECTIONS.map((s) => s.value));

/** Resolve a token to a memorial, whether it's a per-person invite or the
 *  shareable group link. Returns the contributor id when it's a personal one. */
async function resolveToken(slug: string, token: string) {
  const contributor = await db.memorialContributor.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      memorialId: true,
      memorial: { select: { slug: true, treeId: true, personId: true } },
    },
  });
  if (contributor && contributor.memorial.slug === slug) {
    return {
      memorialId: contributor.memorialId,
      contributorId: contributor.id as string | null,
      defaultName: contributor.name,
      treeId: contributor.memorial.treeId,
      personId: contributor.memorial.personId,
    };
  }
  const m = await db.memorial.findFirst({
    where: { groupContribToken: token, slug },
    select: { id: true, treeId: true, personId: true },
  });
  if (m) {
    return { memorialId: m.id, contributorId: null, defaultName: "", treeId: m.treeId, personId: m.personId };
  }
  return null;
}

export async function submitContribution(slug: string, token: string, formData: FormData) {
  const ctx = await resolveToken(slug, token);
  if (!ctx) redirect(`/m/${slug}`);

  const authorName =
    String(formData.get("authorName") ?? "").trim().slice(0, 120) || ctx.defaultName;
  if (authorName.length < 2) redirect(`/m/${slug}/contribute/${token}?err=name`);

  const rawSection = String(formData.get("section") ?? "memory");
  const section = SECTION_VALUES.has(rawSection) ? rawSection : "other";
  const body = String(formData.get("body") ?? "").trim().slice(0, 8000);
  if (body.length < 3) redirect(`/m/${slug}/contribute/${token}?err=1`);

  await db.memorialContribution.create({
    data: { memorialId: ctx.memorialId, contributorId: ctx.contributorId, authorName, section, body },
  });

  await notifyTreeManagers(ctx.treeId, {
    kind: "memorial.contribution",
    title: "New memorial contribution",
    body: `${authorName}: "${body.slice(0, 140)}"`,
    linkPath: `/trees/${ctx.treeId}/people/${ctx.personId}/memorial`,
  });

  revalidatePath(`/m/${slug}/contribute/${token}`);
  redirect(`/m/${slug}/contribute/${token}?sent=1`);
}
