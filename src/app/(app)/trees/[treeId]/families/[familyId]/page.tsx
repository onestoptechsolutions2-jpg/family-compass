import Link from "next/link";
import { notFound } from "next/navigation";
import { FamilyType } from "@prisma/client";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { getFamilyDetail } from "@/lib/queries/families";
import { personOptions } from "@/lib/queries/people";
import { formatDate, dateSortKey } from "@/lib/date";
import { PersonChip } from "@/components/PersonChip";
import { PersonSelect } from "@/components/PersonSelect";
import { updateFamily, addChild, removeChild, deleteFamily } from "../actions";

export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ treeId: string; familyId: string }>;
}) {
  const { treeId, familyId } = await params;
  const ctx = await loadTreeContext(treeId);
  const family = await getFamilyDetail(treeId, familyId);
  if (!family) notFound();
  const editable = canEdit(ctx.role);
  const options = editable ? await personOptions(treeId) : [];

  const childIds = new Set(family.childRefs.map((c) => c.person.id));
  const childOptions = options.filter(
    (o) => !childIds.has(o.id) && o.id !== family.partner1Id && o.id !== family.partner2Id,
  );

  const events = family.eventRefs
    .map((r) => r.event)
    .sort((a, b) => dateSortKey(a).localeCompare(dateSortKey(b)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/trees/${treeId}/families`}
            className="text-sm hover:underline"
            style={{ color: "var(--muted)" }}
          >
            ← Families
          </Link>
          <h2 className="mt-1 text-xl font-semibold">Family</h2>
        </div>
        {editable && (
          <form action={deleteFamily.bind(null, treeId, familyId)}>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm text-red-600"
              style={{ borderColor: "var(--border)" }}
            >
              Delete family
            </button>
          </form>
        )}
      </div>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Partners</h3>
        {editable ? (
          <form action={updateFamily.bind(null, treeId, familyId)} className="mt-3 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Partner 1</span>
                <PersonSelect name="partner1Id" options={options} defaultValue={family.partner1Id} />
              </label>
              <label className="text-sm">
                <span style={{ color: "var(--muted)" }}>Partner 2</span>
                <PersonSelect name="partner2Id" options={options} defaultValue={family.partner2Id} />
              </label>
            </div>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Type</span>
              <select
                name="type"
                defaultValue={family.type}
                className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                {Object.values(FamilyType).map((t) => (
                  <option key={t} value={t}>
                    {t.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                Save partners
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <PersonChip person={family.partner1} treeId={treeId} />
            <PersonChip person={family.partner2} treeId={treeId} />
          </div>
        )}
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Children</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {family.childRefs.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <PersonChip person={c.person} treeId={treeId} />
              {editable && (
                <form action={removeChild.bind(null, treeId, familyId, c.id)}>
                  <button className="text-xs text-red-600 hover:underline">remove</button>
                </form>
              )}
            </li>
          ))}
          {family.childRefs.length === 0 && (
            <li className="text-sm" style={{ color: "var(--muted)" }}>
              No children recorded.
            </li>
          )}
        </ul>
        {editable && childOptions.length > 0 && (
          <form action={addChild.bind(null, treeId, familyId)} className="mt-3 flex items-end gap-2">
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Add existing person as child</span>
              <PersonSelect name="personId" options={childOptions} allowEmpty={false} />
            </label>
            <button className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              Add
            </button>
          </form>
        )}
      </section>

      {events.length > 0 && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h3 className="font-medium">Family events</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-28 shrink-0" style={{ color: "var(--muted)" }}>
                  {formatDate(e) || "—"}
                </span>
                <span>
                  <span className="font-medium">{e.type}</span>
                  {e.place ? ` · ${e.place.title}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
