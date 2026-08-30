import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";
import { displayName } from "@/lib/person";

export const dynamic = "force-dynamic";

const N = { first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true, preferred: true, type: true, order: true } as const;

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

  const rows = await db.family.findMany({
    where: { treeId },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      partner1Id: true,
      partner2Id: true,
      partner1: { select: { names: { select: N } } },
      partner2: { select: { names: { select: N } } },
      childRefs: { orderBy: { order: "asc" }, select: { personId: true } },
    },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return apiOk(
    page.map((f) => ({
      id: f.id,
      type: f.type,
      partner1: f.partner1Id ? { id: f.partner1Id, name: displayName(f.partner1!.names) } : null,
      partner2: f.partner2Id ? { id: f.partner2Id, name: displayName(f.partner2!.names) } : null,
      childIds: f.childRefs.map((c) => c.personId),
    })),
    { headers: { "X-Next-Cursor": hasMore ? (page[page.length - 1]?.id ?? "") : "" } },
  );
}
