import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiPreflight();
}

/**
 * Chosen / kin relationship edges for a tree — the research payload. Person
 * ids only, no names and no free-text origin story, so this is safe to sync
 * without leaking living-person PII.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ treeId: string }> }) {
  const ctx = await authenticateApi(req, "read");
  if (isResponse(ctx)) return ctx;
  const { treeId } = await params;
  const tree = await requireApiTree(ctx, treeId);
  if (isResponse(tree)) return tree;

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const cursor = url.searchParams.get("cursor");

  const rows = await db.relationEdge.findMany({
    where: { treeId },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      aPersonId: true,
      bPersonId: true,
      kind: true,
      roles: true,
      score: true,
      originContext: true,
      originViaPersonId: true,
      firstMemoryAt: true,
      lastInteractionAt: true,
      _count: { select: { assertions: true } },
    },
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return apiOk(
    page.map((e) => ({
      id: e.id,
      personA: e.aPersonId,
      personB: e.bPersonId,
      kind: e.kind,
      roles: e.roles,
      score: e.score,
      originContext: e.originContext,
      via: e.originViaPersonId,
      reciprocated: e._count.assertions >= 2,
      firstMemoryAt: e.firstMemoryAt,
      lastInteractionAt: e.lastInteractionAt,
    })),
    { headers: { "X-Next-Cursor": hasMore ? (page[page.length - 1]?.id ?? "") : "" } },
  );
}
