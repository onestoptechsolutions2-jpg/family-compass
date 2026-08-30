import type { NextRequest } from "next/server";

import { authenticateApi, requireApiTree } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";
import { getTreeStatistics } from "@/lib/queries/statistics";

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

  const stats = await getTreeStatistics(treeId);
  return apiOk(stats);
}
