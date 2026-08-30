import Link from "next/link";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { listFamilies } from "@/lib/queries/families";

export const metadata = { title: "Families" };

export default async function FamiliesPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  const families = await listFamilies(treeId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {families.length} families
        </p>
        {canEdit(ctx.role) && (
          <Link
            href={`/trees/${treeId}/families/new`}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add family
          </Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 font-medium">Partners</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Children</th>
            </tr>
          </thead>
          <tbody>
            {families.map((f) => (
              <tr key={f.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2">
                  <Link href={`/trees/${treeId}/families/${f.id}`} className="font-medium hover:underline">
                    {f.label}
                  </Link>
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {f.type.toLowerCase()}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {f.children}
                </td>
              </tr>
            ))}
            {families.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No families yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
