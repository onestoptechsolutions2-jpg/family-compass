import { loadTreeContext } from "@/lib/rbac";
import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Sharing" };

export default async function SharingPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  return (
    <Placeholder title="Sharing — coming in phase 5">
      Invite relatives by email with viewer / contributor / editor roles, and publish a
      read-only tree centered on a chosen person (living people redacted automatically).
    </Placeholder>
  );
}
