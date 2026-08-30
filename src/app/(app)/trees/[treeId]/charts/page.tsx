import { loadTreeContext } from "@/lib/rbac";
import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Charts & exports" };

export default async function ChartsPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  await loadTreeContext(treeId);
  return (
    <Placeholder title="Charts & exports — coming in phase 6">
      Generate pedigree, fan, descendant and family-book PDFs, plus GEDCOM / .gramps exports.
      Preview any of them free with a watermark, then pay KES 750 by M-Pesa to download a clean
      high-resolution copy.
    </Placeholder>
  );
}
