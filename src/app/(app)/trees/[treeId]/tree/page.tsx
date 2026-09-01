import Link from "next/link";

import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getTreeGraph } from "@/lib/queries/graph";
import { TreeExplorer } from "@/components/tree/TreeExplorer";
import { setHomePersonFromTree } from "./actions";

export const metadata = { title: "Tree view" };

export default async function TreeViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { treeId } = await params;
  const { focus } = await searchParams;
  const ctx = await loadTreeContext(treeId);

  const tree = await db.tree.findUniqueOrThrow({
    where: { id: treeId },
    select: { homePersonId: true, _count: { select: { people: true } } },
  });

  if (tree._count.people === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This tree has no people yet.
        </p>
        <Link
          href={`/trees/${treeId}/people/new`}
          className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add the first person
        </Link>
      </div>
    );
  }

  // A claimed relative sees the tree centred on *themselves* by default.
  const mine = await db.person.findFirst({
    where: { treeId, claimedByUserId: ctx.user.id },
    select: { id: true },
  });
  const initialCenterId = focus ?? mine?.id ?? tree.homePersonId ?? null;
  const graph = await getTreeGraph(treeId, initialCenterId);

  const bound = setHomePersonFromTree.bind(null, treeId);

  return (
    <TreeExplorer
      treeId={treeId}
      graph={graph}
      initialCenterId={initialCenterId}
      homePersonId={tree.homePersonId}
      canManage={canManageTree(ctx.role)}
      setHomeAction={bound}
    />
  );
}
