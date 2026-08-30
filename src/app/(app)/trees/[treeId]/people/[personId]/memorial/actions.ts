"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { slugify, randomToken } from "@/lib/slug";
import { displayName } from "@/lib/person";
import { formatDate } from "@/lib/date";
import { draftEulogyText } from "@/lib/queries/memorial";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/webhooks";

async function ownMemorial(treeId: string, memorialId: string) {
  const m = await db.memorial.findFirst({
    where: { id: memorialId, treeId },
    select: { id: true, personId: true, program: { select: { id: true } } },
  });
  if (!m) throw new Error("Memorial not found");
  return m;
}

export async function createMemorial(treeId: string, personId: string) {
  const ctx = await requireTreeEdit(treeId);
  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      names: {
        select: {
          first: true,
          surname: true,
          surnamePrefix: true,
          suffix: true,
          nick: true,
          title: true,
          preferred: true,
          type: true,
          order: true,
        },
      },
      eventRefs: {
        select: {
          event: {
            select: {
              type: true,
              dateModifier: true,
              dateQuality: true,
              dateYear: true,
              dateMonth: true,
              dateDay: true,
              dateText: true,
              place: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (!person) throw new Error("Person not found");

  const existing = await db.memorial.findUnique({ where: { personId }, select: { id: true } });
  if (existing) redirect(`/trees/${treeId}/people/${personId}/memorial`);

  const name = displayName(person.names);
  const birth = person.eventRefs.find((r) => r.event.type === "Birth")?.event;
  const death = person.eventRefs.find((r) => r.event.type === "Death")?.event;
  const eulogyDraft = await draftEulogyText(treeId, personId);

  await db.memorial.create({
    data: {
      personId,
      treeId,
      slug: `${slugify(name) || "memorial"}-${randomToken(6)}`,
      headline: `In loving memory of ${name}`,
      eulogy: eulogyDraft,
      bornText: birth
        ? [formatDate(birth), birth.place?.title].filter(Boolean).join(" · ")
        : null,
      diedText: death ? [formatDate(death), death.place?.title].filter(Boolean).join(" · ") : null,
      createdById: ctx.user.id,
    },
  });
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "created",
    objectType: "memorial",
    objectId: personId,
    summary: `opened a memorial for ${name}`,
  });
  redirect(`/trees/${treeId}/people/${personId}/memorial`);
}

const memorialSchema = z.object({
  headline: z.string().trim().max(200).optional(),
  eulogy: z.string().trim().max(20000).optional(),
  bornText: z.string().trim().max(200).optional(),
  diedText: z.string().trim().max(200).optional(),
  restingPlace: z.string().trim().max(300).optional(),
  serviceText: z.string().trim().max(4000).optional(),
  published: z.coerce.boolean().default(false),
  guestbookOpen: z.coerce.boolean().default(false),
  guestbookModerated: z.coerce.boolean().default(false),
  includeLiving: z.coerce.boolean().default(false),
});

export async function updateMemorial(treeId: string, memorialId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  await ownMemorial(treeId, memorialId);
  const d = memorialSchema.parse(Object.fromEntries(formData));
  const before = await db.memorial.findUniqueOrThrow({
    where: { id: memorialId },
    select: { published: true, slug: true, personId: true, tree: { select: { workspaceId: true } } },
  });
  await db.memorial.update({
    where: { id: memorialId },
    data: {
      headline: d.headline || null,
      eulogy: d.eulogy || null,
      bornText: d.bornText || null,
      diedText: d.diedText || null,
      restingPlace: d.restingPlace || null,
      serviceText: d.serviceText || null,
      published: d.published,
      guestbookOpen: d.guestbookOpen,
      guestbookModerated: d.guestbookModerated,
      includeLiving: d.includeLiving,
    },
  });

  const wsId = before.tree.workspaceId;
  if (d.published && !before.published) {
    await emitEvent(wsId, "memorial.published", { memorialSlug: before.slug, personId: before.personId }, { treeId });
  } else if (d.published && before.published) {
    await emitEvent(wsId, "memorial.updated", { memorialSlug: before.slug, personId: before.personId }, { treeId });
  }

  revalidatePath(`/trees/${treeId}/people/${before.personId}/memorial`);
  revalidatePath(`/trees/${treeId}/people`);
}

/** Regenerate the eulogy draft from tree records. Overwrites only if asked. */
export async function draftEulogy(treeId: string, memorialId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  const overwrite = formData.get("overwrite") === "1";
  const current = await db.memorial.findUniqueOrThrow({
    where: { id: memorialId },
    select: { eulogy: true },
  });
  const draft = await draftEulogyText(treeId, m.personId);
  if (!draft) return;
  const next =
    overwrite || !current.eulogy?.trim()
      ? draft
      : `${current.eulogy.trim()}\n\n— draft from records —\n\n${draft}`;
  await db.memorial.update({ where: { id: memorialId }, data: { eulogy: next } });
  revalidatePath(`/trees/${treeId}/people/${m.personId}/memorial`);
}

export async function setMemorialCover(treeId: string, memorialId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  const mediaId = String(formData.get("coverMediaId") ?? "").trim() || null;
  if (mediaId) {
    const ok = await db.mediaRef.findFirst({
      where: { mediaId, personId: m.personId },
      select: { id: true },
    });
    if (!ok) throw new Error("Pick a photo attached to this person");
  }
  await db.memorial.update({ where: { id: memorialId }, data: { coverMediaId: mediaId } });
  revalidatePath(`/trees/${treeId}/people/${m.personId}/memorial`);
}

export async function saveProgram(treeId: string, memorialId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);

  const titles = formData.getAll("itemTitle").map(String);
  const details = formData.getAll("itemDetail").map(String);
  const order = titles
    .map((t, i) => ({ title: t.trim(), detail: (details[i] ?? "").trim() }))
    .filter((x) => x.title);

  const venue = String(formData.get("venue") ?? "").trim() || null;
  const committee = String(formData.get("committee") ?? "").trim() || null;
  const serviceDateRaw = String(formData.get("serviceDate") ?? "").trim();
  const serviceDate = /^\d{4}-\d{2}-\d{2}/.test(serviceDateRaw) ? new Date(serviceDateRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const program = await db.funeralProgram.upsert({
    where: { memorialId },
    update: { venue, committee, serviceDate, order, updatedById: ctx.user.id },
    create: { memorialId, venue, committee, serviceDate, order, updatedById: ctx.user.id },
    select: { id: true },
  });
  await db.programRevision.create({
    data: {
      programId: program.id,
      editedById: ctx.user.id,
      note,
      snapshot: { venue, committee, serviceDate: serviceDate?.toISOString() ?? null, order },
    },
  });
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "updated",
    objectType: "funeralProgram",
    objectId: m.personId,
    summary: `updated the funeral program${note ? ` — ${note}` : ""}`,
  });
  revalidatePath(`/trees/${treeId}/people/${m.personId}/memorial`);
}

export async function moderateGuestbook(
  treeId: string,
  memorialId: string,
  entryId: string,
  status: "APPROVED" | "HIDDEN",
) {
  await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  const e = await db.guestbookEntry.findFirst({
    where: { id: entryId, memorialId },
    select: { id: true },
  });
  if (!e) throw new Error("Entry not found");
  await db.guestbookEntry.update({ where: { id: entryId }, data: { status } });
  revalidatePath(`/trees/${treeId}/people/${m.personId}/memorial`);
}

export async function deleteMemorial(treeId: string, memorialId: string) {
  await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  await db.memorial.delete({ where: { id: memorialId } });
  redirect(`/trees/${treeId}/people/${m.personId}`);
}
