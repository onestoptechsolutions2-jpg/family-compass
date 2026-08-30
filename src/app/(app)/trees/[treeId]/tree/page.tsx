import { loadTreeContext } from "@/lib/rbac";
import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Tree view" };

export default async function TreeViewPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  return (
    <Placeholder title="Interactive tree — coming in phase 3">
      Pan-and-zoom ancestor / descendant / hourglass views with click-to-re-root and a fan chart.
    </Placeholder>
  );
}
