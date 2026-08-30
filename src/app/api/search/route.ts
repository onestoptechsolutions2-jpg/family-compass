import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { searchTree, searchAcrossTrees } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const treeId = url.searchParams.get("tree");

  if (treeId) {
    const ok = await db.tree.findFirst({
      where: {
        id: treeId,
        OR: [
          { workspace: { memberships: { some: { userId: user.id } } } },
          ...(user.isPlatformAdmin ? [{}] : []),
        ],
      },
      select: { id: true },
    });
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ hits: await searchTree(treeId, q) });
  }

  return NextResponse.json({ hits: await searchAcrossTrees(user.id, q) });
}
