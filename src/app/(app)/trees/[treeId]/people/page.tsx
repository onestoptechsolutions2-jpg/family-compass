import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { canEdit } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listPeople } from "@/lib/queries/people";
import { locationHints } from "@/lib/queries/locations";
import { genderSymbol, genderColor, genderLabel } from "@/lib/person";
import { Dialog } from "@/components/Dialog";
import { PersonForm } from "@/components/PersonForm";
import { createPerson } from "./actions";

export const metadata = { title: "People" };

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { treeId } = await params;
  const { q } = await searchParams;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const [people, clans, hints] = await Promise.all([
    listPeople(treeId, q?.trim() || undefined),
    editable
      ? db.clan.findMany({ where: { treeId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    editable ? locationHints() : Promise.resolve([] as string[]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, parent or spouse…"
            className="w-64 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            Search
          </button>
        </form>
        {editable && (
          <Dialog
            title="Add a person"
            label="＋ Add person"
            wide
            buttonClass="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <PersonForm
              action={createPerson.bind(null, treeId)}
              submitLabel="Create person"
              clans={clans}
              locationHints={hints}
            />
          </Dialog>
        )}
      </div>

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {people.length} {people.length === 1 ? "person" : "people"}
      </p>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 font-medium" aria-label="Sex" />
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Born</th>
              <th className="px-3 py-2 font-medium">Died</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2">
                  {genderSymbol(p.gender) ? (
                    <span
                      className="text-sm font-bold"
                      title={genderLabel(p.gender)}
                      style={{ color: genderColor(p.gender) }}
                    >
                      {genderSymbol(p.gender)}
                    </span>
                  ) : (
                    <span title="Unspecified" style={{ color: "var(--muted)" }}>·</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {p.deceased && (
                    <span className="mr-1" title="Deceased" style={{ color: "var(--muted)" }}>†</span>
                  )}
                  <Link href={`/trees/${treeId}/people/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  {(p.parents.length > 0 || p.spouses.length > 0) && (
                    <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      {p.parents.length > 0 && (
                        <span>
                          {p.gender === "F" ? "d/o " : p.gender === "M" ? "s/o " : "child of "}
                          {p.parents.join(" & ")}
                        </span>
                      )}
                      {p.parents.length > 0 && p.spouses.length > 0 && <span> · </span>}
                      {p.spouses.length > 0 && <span>m. {p.spouses.join(", ")}</span>}
                      {p.matchedVia === "parent" && (
                        <span className="ml-1" style={{ color: "var(--accent)" }}>· matched parent</span>
                      )}
                      {p.matchedVia === "spouse" && (
                        <span className="ml-1" style={{ color: "var(--accent)" }}>· matched spouse</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {p.birth || "—"}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                  {p.death || "—"}
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No people {q ? "match your search" : "yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
