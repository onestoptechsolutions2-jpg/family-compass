import Link from "next/link";
import { FamilyType } from "@prisma/client";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { listFamilies } from "@/lib/queries/families";
import { personOptions } from "@/lib/queries/people";
import { PersonSelect } from "@/components/PersonSelect";
import { Dialog } from "@/components/Dialog";
import { createFamily } from "./actions";

export const metadata = { title: "Families" };

export default async function FamiliesPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const [families, options] = await Promise.all([
    listFamilies(treeId),
    editable ? personOptions(treeId) : Promise.resolve([]),
  ]);
  const sel = { borderColor: "var(--border)", background: "var(--bg)" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {families.length} families
        </p>
        {editable && (
          <Dialog
            title="Add a family"
            label="＋ Add family"
            buttonClass="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <form action={createFamily.bind(null, treeId)} className="flex flex-col gap-4">
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Partner 1</span>
                <PersonSelect name="partner1Id" options={options} allowCreate />
              </label>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Partner 2</span>
                <PersonSelect name="partner2Id" options={options} allowCreate />
              </label>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Relationship type</span>
                <select name="type" defaultValue={FamilyType.MARRIED} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={sel}>
                  <option value={FamilyType.MARRIED}>Married</option>
                  <option value={FamilyType.UNMARRIED}>Unmarried partners</option>
                  <option value={FamilyType.CIVIL_UNION}>Civil union</option>
                  <option value={FamilyType.UNKNOWN}>Unknown</option>
                </select>
              </label>
              <button className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Create family
              </button>
            </form>
          </Dialog>
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
