import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiPreflight();
}

/** Recent activity feed for a tree (audit-style stream). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ treeId: string }> }) {
  const ctx = await authenticateApi(req, "read");
  if (isResponse(ctx)) return ctx;
  const { treeId } = await params;
  const tree = await requireApiTree(ctx, treeId);
  if (isResponse(tree)) return tree;

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const cursor = url.searchParams.get("cursor");

  const rows = await db.activityEvent.findMany({
    where: { treeId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      verb: true,
      objectType: true,
      objectId: true,
      summary: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return apiOk(
    page.map((e) => ({
      id: e.id,
      verb: e.verb,
      objectType: e.objectType,
      objectId: e.objectId,
      summary: e.summary,
      actor: e.actor ? { id: e.actor.id, name: e.actor.name } : null,
      createdAt: e.createdAt.toISOString(),
    })),
    { headers: { "X-Next-Cursor": hasMore ? (page[page.length - 1]?.id ?? "") : "" } },
  );
}
