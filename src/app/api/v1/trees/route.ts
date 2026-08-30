import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { authenticateApi } from "@/lib/api/auth";
import { apiOk, apiPreflight, isResponse } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiPreflight();
}

export async function GET(req: NextRequest) {
  const ctx = await authenticateApi(req, "read");
  if (isResponse(ctx)) return ctx;

  const trees = await db.tree.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      community: true,
      region: true,
      discoverable: true,
      createdAt: true,
      _count: { select: { people: true, families: true } },
    },
  });

  return apiOk(
    trees.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      community: t.community,
      region: t.region,
      discoverable: t.discoverable,
      counts: { people: t._count.people, families: t._count.families },
      createdAt: t.createdAt.toISOString(),
    })),
  );
}
