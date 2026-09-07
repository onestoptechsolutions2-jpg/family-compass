import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { canEdit, canManageTree } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listPeople, type PersonListRow } from "@/lib/queries/people";
import { locationHints } from "@/lib/queries/locations";
import { genderSymbol, genderColor, genderLabel, birthCohort, BIRTH_COHORTS } from "@/lib/person";
import { chamaEnabled } from "@/lib/chama/plugin";
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
  const manages = canManageTree(ctx.role);
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

      {q ? (
        <PeopleTable treeId={treeId} people={people} q={q} />
      ) : (
        <GroupedByGeneration treeId={treeId} people={people} manages={manages && chamaEnabled()} />
      )}
    </div>
  );
}

function GroupedByGeneration({
  treeId,
  people,
  manages,
}: {
  treeId: string;
  people: PersonListRow[];
  manages: boolean;
}) {
  const groups = new Map<string, PersonListRow[]>();
  for (const p of people) {
    const cohort = birthCohort(p.birthYear) ?? "Generation unknown";
    (groups.get(cohort) ?? groups.set(cohort, []).get(cohort)!).push(p);
  }
  const order = [...BIRTH_COHORTS.map((c) => c.label).reverse(), "Generation unknown"];
  const populated = order.filter((label) => (groups.get(label)?.length ?? 0) > 0);

  if (populated.length === 0) {
    return (
      <p className="rounded-xl border px-3 py-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        No people yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {populated.map((label) => {
        const rows = groups.get(label)!;
        return (
          <div key={label}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                {label} <span style={{ color: "var(--muted)" }}>· {rows.length}</span>
              </h2>
              {manages && label !== "Generation unknown" && (
                <Link
                  href={`/trees/${treeId}/chama/groups?suggest=${encodeURIComponent(`${label} — family group`)}`}
                  className="text-xs hover:underline"
                  style={{ color: "var(--link)" }}
                >
                  Start a {label} group →
                </Link>
              )}
            </div>
            <PeopleTable treeId={treeId} people={rows} />
          </div>
        );
      })}
    </div>
  );
}

function PeopleTable({ treeId, people, q }: { treeId: string; people: PersonListRow[]; q?: string }) {
  return (
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
  );
}
