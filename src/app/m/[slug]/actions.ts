"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { notifyTreeManagers } from "@/lib/notify";
import { emitEvent } from "@/lib/webhooks";
import { resolveGuestRelationship } from "@/lib/queries/memorial";
import { isFlowerKind } from "@/lib/memorial-flowers";

/** One-tap tribute (flower / candle / wreath / heart). No message, no review. */
export async function layFlower(slug: string, formData: FormData) {
  const m = await db.memorial.findUnique({
    where: { slug },
    select: { id: true, published: true },
  });
  if (!m || !m.published) redirect(`/m/${slug}`);

  const rawKind = String(formData.get("kind") ?? "flower");
  const kind = isFlowerKind(rawKind) ? rawKind : "flower";
  const nameRaw = String(formData.get("name") ?? "").trim().slice(0, 80);
  const name = nameRaw.length >= 2 ? nameRaw : null;

  // light per-browser cap so nobody carpets the wall
  const jar = await cookies();
  const key = `fc_fl_${slug}`;
  const laid = Number(jar.get(key)?.value ?? "0");
  if (laid >= 12) redirect(`/m/${slug}?flower=cap#tributes`);

  const h = await headers();
  await db.memorialFlower.create({
    data: { memorialId: m.id, kind, name, ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null },
  });
  jar.set(key, String(laid + 1), { httpOnly: true, sameSite: "lax", path: `/m/${slug}`, maxAge: 86400 });

  revalidatePath(`/m/${slug}`);
  redirect(`/m/${slug}?flower=1#tributes`);
}

/** Manager hides / restores a flower from the memorial editor. */
export async function moderateFlower(treeId: string, flowerId: string, hidden: boolean) {
  await requireTreeEdit(treeId);
  const f = await db.memorialFlower.findFirst({
    where: { id: flowerId, memorial: { treeId } },
    select: { memorial: { select: { personId: true } } },
  });
  if (!f) throw new Error("Not found");
  await db.memorialFlower.update({ where: { id: flowerId }, data: { hidden } });
  revalidatePath(`/trees/${treeId}/people/${f.memorial.personId}/memorial`);
}

export async function postGuestbook(slug: string, formData: FormData) {
  const m = await db.memorial.findUnique({
    where: { slug },
    select: {
      id: true,
      published: true,
      guestbookOpen: true,
      guestbookModerated: true,
      treeId: true,
      personId: true,
      headline: true,
      tree: { select: { workspaceId: true } },
    },
  });
  if (!m || !m.published || !m.guestbookOpen) redirect(`/m/${slug}`);

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const typedRelation = String(formData.get("relation") ?? "").trim().slice(0, 80) || null;
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30) || null;
  if (name.length < 2 || message.length < 3) redirect(`/m/${slug}?err=1`);

  // If the signer's name matches someone in the tree, use their recorded
  // relationship to the deceased instead of a guessed one.
  const matched = await resolveGuestRelationship(m.treeId, m.personId, name).catch(() => null);
  const relation = matched
    ? matched.label + (typedRelation && !typedRelation.includes(matched.label) ? ` · ${typedRelation}` : "")
    : typedRelation;

  const h = await headers();
  const entry = await db.guestbookEntry.create({
    data: {
      memorialId: m.id,
      name,
      relation,
      message,
      phone,
      status: m.guestbookModerated ? "PENDING" : "APPROVED",
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
    select: { id: true, status: true },
  });

  await notifyTreeManagers(m.treeId, {
    kind: "guestbook.created",
    title: m.guestbookModerated ? "Guestbook message awaiting approval" : "New guestbook message",
    body: `${name}: "${message.slice(0, 140)}"`,
    linkPath: `/m/${slug}`,
  });
  await emitEvent(
    m.tree.workspaceId,
    "guestbook.created",
    { memorialSlug: slug, entry: { id: entry.id, name, relation, message, status: entry.status } },
    { treeId: m.treeId },
  );

  revalidatePath(`/m/${slug}`);
  const q = new URLSearchParams({ posted: m.guestbookModerated ? "review" : "1" });
  if (matched) q.set("rel", matched.label);
  else q.set("new", "1");
  redirect(`/m/${slug}?${q.toString()}#guestbook`);
}
