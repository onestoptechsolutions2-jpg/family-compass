import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";

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

  const [people, families, events, places, sources, memorials] = await Promise.all([
    db.person.count({ where: { treeId } }),
    db.family.count({ where: { treeId } }),
    db.event.count({ where: { treeId } }),
    db.place.count({ where: { treeId } }),
    db.source.count({ where: { treeId } }),
    db.memorial.count({ where: { treeId, published: true } }),
  ]);

  return apiOk({
    id: tree.id,
    name: tree.name,
    slug: tree.slug,
    counts: { people, families, events, places, sources, publishedMemorials: memorials },
  });
}
