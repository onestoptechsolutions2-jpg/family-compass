"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Gender } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/rbac";
import { startDbSession } from "@/lib/session";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { createBarePerson, setVitalEvent } from "@/lib/person-write";
import { slugify, randomToken } from "@/lib/slug";
import { isValidPhone, normalizePhone } from "@/lib/wa";
import { logActivity } from "@/lib/activity";

const COOKIE = "fc_start";

const schema = z.object({
  first: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  birthYear: z.coerce.number().int().min(1850).max(new Date().getFullYear()).optional(),
  community: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(30),
});
export type StartDraft = z.infer<typeof schema>;

export async function readStartDraft(): Promise<StartDraft | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function startCheck(formData: FormData) {
  if (!env.SELF_START) redirect("/login");
  if (await getSessionUser()) redirect("/app");

  const d = schema.parse({
    first: formData.get("first"),
    surname: formData.get("surname"),
    gender: formData.get("gender") ?? "UNKNOWN",
    birthYear: formData.get("birthYear") || undefined,
    community: formData.get("community") ?? "",
    region: formData.get("region") ?? "",
    phone: formData.get("phone"),
  });
  if (!isValidPhone(d.phone)) redirect("/start?err=phone");

  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify({ ...d, phone: normalizePhone(d.phone) }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/start",
    maxAge: 900,
  });
  redirect("/start?step=review");
}

export async function startCreate() {
  if (!env.SELF_START) redirect("/login");
  if (await getSessionUser()) redirect("/app");

  const d = await readStartDraft();
  if (!d) redirect("/start");
  const phone = normalizePhone(d.phone);
  const synthEmail = `${phone}@wa.local`;
  const name = `${d.first} ${d.surname}`.trim();

  // find or create the user (WhatsApp-number identity, no email/password)
  let user = await db.user.findFirst({
    where: { OR: [{ phone }, { email: synthEmail }] },
    select: { id: true, memberships: { where: { role: "OWNER" }, select: { id: true }, take: 1 } },
  });

  if (user && user.memberships.length > 0) {
    // already has a workspace — just sign them in
    await startDbSession(user.id);
    (await cookies()).delete(COOKIE);
    redirect("/app");
  }

  if (!user) {
    const created = await db.user.create({
      data: { name, email: synthEmail, phone },
      select: { id: true },
    });
    user = { id: created.id, memberships: [] };
  }

  await ensurePersonalWorkspace(user.id, name);
  const ws = await db.membership.findFirstOrThrow({
    where: { userId: user.id, role: "OWNER" },
    select: { workspaceId: true },
  });

  const base = slugify(`${d.first}-family`) || "family";
  let treeSlug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await db.tree.findFirst({
      where: { workspaceId: ws.workspaceId, slug: treeSlug },
      select: { id: true },
    });
    if (!clash) break;
    treeSlug = `${base}-${randomToken(4)}`;
  }

  const tree = await db.tree.create({
    data: {
      workspaceId: ws.workspaceId,
      name: `${d.first}'s family`,
      slug: treeSlug,
      community: d.community || null,
      region: d.region || null,
    },
    select: { id: true },
  });

  const person = await createBarePerson(tree.id, {
    first: d.first,
    surname: d.surname,
    gender: Gender[d.gender],
    living: true,
  });
  if (d.birthYear) {
    await setVitalEvent(tree.id, person.id, "Birth", String(d.birthYear), "");
  }
  await db.tree.update({ where: { id: tree.id }, data: { homePersonId: person.id } });
  await db.person.update({
    where: { id: person.id },
    data: { claimedByUserId: user.id, phone },
  });
  await logActivity({
    treeId: tree.id,
    actorId: user.id,
    verb: "created",
    objectType: "tree",
    objectId: tree.id,
    summary: `${name} started their family tree`,
  });

  await startDbSession(user.id);
  (await cookies()).delete(COOKIE);
  redirect(`/trees/${tree.id}/people/${person.id}`);
}
