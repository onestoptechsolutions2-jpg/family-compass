import { loadTreeContext } from "@/lib/rbac";
import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Media" };

export default async function MediaPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  return (
    <Placeholder title="Media — coming in phase 4">
      Upload photos and documents (stored in Postgres), auto-thumbnail them, and attach them to
      people, events and places.
    </Placeholder>
  );
}
