import type { NextRequest } from "next/server";
import { z } from "zod";
import { Gender } from "@prisma/client";

import { db } from "@/lib/db";
import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiError, apiPreflight, isResponse } from "@/lib/api/respond";
import { API_PERSON_SELECT, serializePerson } from "@/lib/api/serialize";
import { createBarePerson, setVitalEvent } from "@/lib/person-write";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/webhooks";
import { displayName } from "@/lib/person";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiPreflight();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ treeId: string }> }) {
  const ctx = await authenticateApi(req, "read");
  if (isResponse(ctx)) return ctx;
  const { treeId } = await params;
  const tree = await requireApiTree(ctx, treeId);
  if (isResponse(tree)) return tree;

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const cursor = url.searchParams.get("cursor");
  const q = url.searchParams.get("q")?.trim();

  const rows = await db.person.findMany({
    where: {
      treeId,
      ...(q
        ? { names: { some: { OR: [{ first: { contains: q, mode: "insensitive" } }, { surname: { contains: q, mode: "insensitive" } }] } } }
        : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: API_PERSON_SELECT,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return apiOk(page.map(serializePerson), {
    headers: { "X-Next-Cursor": hasMore ? (page[page.length - 1]?.id ?? "") : "" },
  });
}

const createSchema = z.object({
  first: z.string().trim().max(120).optional(),
  surname: z.string().trim().max(120).optional(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  living: z.boolean().optional(),
  birthDate: z.string().trim().max(60).optional(),
  birthPlace: z.string().trim().max(200).optional(),
  deathDate: z.string().trim().max(60).optional(),
  deathPlace: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ treeId: string }> }) {
  const ctx = await authenticateApi(req, "write");
  if (isResponse(ctx)) return ctx;
  const { treeId } = await params;
  const tree = await requireApiTree(ctx, treeId);
  if (isResponse(tree)) return tree;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, "invalid_request", "Body must be JSON.");
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid body.");
  }
  const b = parsed.data;
  if (!b.first && !b.surname) {
    return apiError(400, "invalid_request", "Provide at least 'first' or 'surname'.");
  }

  const person = await createBarePerson(treeId, {
    first: b.first,
    surname: b.surname,
    gender: b.gender ? Gender[b.gender] : undefined,
    living: b.living ?? !b.deathDate,
  });
  if (b.birthDate || b.birthPlace) {
    await setVitalEvent(treeId, person.id, "Birth", b.birthDate ?? "", b.birthPlace ?? "");
  }
  if (b.deathDate || b.deathPlace) {
    await setVitalEvent(treeId, person.id, "Death", b.deathDate ?? "", b.deathPlace ?? "");
  }

  const full = await db.person.findUniqueOrThrow({ where: { id: person.id }, select: API_PERSON_SELECT });
  const out = serializePerson(full);

  await logActivity({
    treeId,
    verb: "created",
    objectType: "person",
    objectId: person.id,
    summary: `added ${displayName(full.names)} via API`,
  });
  await emitEvent(ctx.workspaceId, "person.created", { treeId, person: out }, { treeId });

  return apiOk(out, { status: 201 });
}
