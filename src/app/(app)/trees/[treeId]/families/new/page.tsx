import Link from "next/link";
import { FamilyType } from "@prisma/client";

import { requireTreeEdit } from "@/lib/rbac";
import { personOptions } from "@/lib/queries/people";
import { PersonSelect } from "@/components/PersonSelect";
import { createFamily } from "../actions";

export const metadata = { title: "Add family" };

export default async function NewFamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ partner?: string }>;
}) {
  const { treeId } = await params;
  const { partner } = await searchParams;
  await requireTreeEdit(treeId);
  const options = await personOptions(treeId);
  const action = createFamily.bind(null, treeId);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Link
        href={`/trees/${treeId}/families`}
        className="text-sm hover:underline"
        style={{ color: "var(--muted)" }}
      >
        ← Family units
      </Link>
      <h2 className="text-lg font-semibold">Add a family unit</h2>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Search for each partner, or type a name and pick “＋ Add …” to create a new person on the
        spot.
      </p>
      <form action={action} className="flex flex-col gap-4">
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Partner 1</span>
          <PersonSelect name="partner1Id" options={options} defaultValue={partner ?? null} allowCreate />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Partner 2</span>
          <PersonSelect name="partner2Id" options={options} allowCreate />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Relationship type</span>
          <select
            name="type"
            defaultValue={FamilyType.MARRIED}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          >
            <option value={FamilyType.MARRIED}>Married</option>
            <option value={FamilyType.UNMARRIED}>Unmarried partners</option>
            <option value={FamilyType.CIVIL_UNION}>Civil union</option>
            <option value={FamilyType.UNKNOWN}>Unknown</option>
          </select>
        </label>
        <div>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create family
          </button>
        </div>
      </form>
    </div>
  );
}
