"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTreeEdit, requireTreeManage } from "@/lib/rbac";
import { slugify, randomToken } from "@/lib/slug";
import { displayName } from "@/lib/person";
import { formatDate } from "@/lib/date";
import { draftEulogyText } from "@/lib/queries/memorial";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/webhooks";
import { notifyTreeManagers } from "@/lib/notify";
import { MERGE_TARGET } from "@/lib/memorial-sections";
import { MemorialStatus, ContributionStatus } from "@prisma/client";

async function ownMemorial(treeId: string, memorialId: string) {
  const m = await db.memorial.findFirst({
    where: { id: memorialId, treeId },
    select: { id: true, personId: true, status: true, slug: true, program: { select: { id: true } } },
  });
  if (!m) throw new Error("Memorial not found");
  return m;
}

function assertUnlocked(m: { status: MemorialStatus }) {
  if (m.status === MemorialStatus.FINAL) {
    throw new Error("This memorial is finalised. Unlock it before editing.");
  }
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
  assertUnlocked(await ownMemorial(treeId, memorialId));
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
  assertUnlocked(m);
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
  assertUnlocked(m);
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
  assertUnlocked(m);

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

// ---------------- collaboration workflow ----------------

const revalidate = (treeId: string, personId: string) =>
  revalidatePath(`/trees/${treeId}/people/${personId}/memorial`);

export async function inviteContributor(treeId: string, memorialId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30) || null;
  const relation = String(formData.get("relation") ?? "").trim().slice(0, 80) || null;
  if (name.length < 2) throw new Error("Add the contributor's name");

  await db.memorialContributor.create({
    data: { memorialId, name, phone, relation, token: randomToken(24), invitedById: ctx.user.id },
  });
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "invited",
    objectType: "memorial",
    objectId: m.personId,
    summary: `invited ${name} to contribute to the memorial`,
  });
  revalidate(treeId, m.personId);
}

export async function removeContributor(treeId: string, memorialId: string, contributorId: string) {
  await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  await db.memorialContributor.deleteMany({ where: { id: contributorId, memorialId } });
  revalidate(treeId, m.personId);
}

export async function reviewContribution(
  treeId: string,
  memorialId: string,
  contributionId: string,
  decision: "ACCEPTED" | "DECLINED",
) {
  const ctx = await requireTreeEdit(treeId);
  const m = await ownMemorial(treeId, memorialId);
  const c = await db.memorialContribution.findFirst({
    where: { id: contributionId, memorialId },
    select: { id: true, section: true, body: true, authorName: true, status: true },
  });
  if (!c || c.status !== ContributionStatus.SUBMITTED) throw new Error("Nothing to review");

  if (decision === "ACCEPTED") {
    assertUnlocked(m);
    const target = MERGE_TARGET[c.section] ?? "eulogy";
    const mem = await db.memorial.findUniqueOrThrow({
      where: { id: memorialId },
      select: { eulogy: true, serviceText: true },
    });
    const prev = (target === "eulogy" ? mem.eulogy : mem.serviceText)?.trim() ?? "";
    const addition = `${c.body.trim()}\n\n— ${c.authorName}`;
    const next = prev ? `${prev}\n\n${addition}` : addition;
    await db.memorial.update({
      where: { id: memorialId },
      data: target === "eulogy" ? { eulogy: next } : { serviceText: next },
    });
  }

  await db.memorialContribution.update({
    where: { id: contributionId },
    data: {
      status: decision === "ACCEPTED" ? ContributionStatus.ACCEPTED : ContributionStatus.DECLINED,
      reviewedById: ctx.user.id,
      reviewedAt: new Date(),
      mergedAt: decision === "ACCEPTED" ? new Date() : null,
    },
  });
  revalidate(treeId, m.personId);
}

/** Move the memorial through DRAFT → IN_REVIEW → FINAL, or reopen it.
 *  Unlocking a FINAL memorial requires the stricter "manage" role. */
export async function setMemorialStatus(
  treeId: string,
  memorialId: string,
  next: "DRAFT" | "IN_REVIEW" | "FINAL",
) {
  const m = await ownMemorial(treeId, memorialId);
  const from = m.status;
  const to = next as MemorialStatus;

  const unlocking = from === MemorialStatus.FINAL && to !== MemorialStatus.FINAL;
  const ctx = unlocking ? await requireTreeManage(treeId) : await requireTreeEdit(treeId);

  if (from === to) return;

  const data: {
    status: MemorialStatus;
    finalisedAt?: Date | null;
    lockedAt?: Date | null;
    lockedById?: string | null;
  } = { status: to };

  if (to === MemorialStatus.FINAL) {
    data.finalisedAt = new Date();
    data.lockedAt = new Date();
    data.lockedById = ctx.user.id;
    if (m.program?.id) {
      await db.programRevision.create({
        data: {
          programId: m.program.id,
          editedById: ctx.user.id,
          note: "Memorial finalised & locked",
          snapshot: { finalisedAt: new Date().toISOString() },
        },
      });
    }
  } else if (unlocking) {
    data.lockedAt = null;
    data.lockedById = null;
  }

  await db.memorial.update({ where: { id: memorialId }, data });

  const verbMap: Record<string, string> = {
    IN_REVIEW: from === MemorialStatus.FINAL ? "unlocked the memorial for editing" : "moved the memorial to review",
    FINAL: "finalised and locked the memorial",
    DRAFT: "reopened the memorial as a draft",
  };
  await logActivity({
    treeId,
    actorId: ctx.user.id,
    verb: "updated",
    objectType: "memorial",
    objectId: m.personId,
    summary: verbMap[to] ?? `set memorial status to ${to}`,
  });
  if (unlocking) {
    await notifyTreeManagers(
      treeId,
      {
        kind: "memorial.updated",
        title: "Memorial unlocked for editing",
        body: `${ctx.user.name ?? ctx.user.email} reopened a finalised memorial.`,
        linkPath: `/trees/${treeId}/people/${m.personId}/memorial`,
      },
      { exceptUserId: ctx.user.id },
    );
  }
  revalidate(treeId, m.personId);
}
