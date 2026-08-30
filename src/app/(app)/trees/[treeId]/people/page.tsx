import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { canEdit } from "@/lib/rbac";
import { listPeople } from "@/lib/queries/people";
import { genderSymbol, genderColor, genderLabel } from "@/lib/person";

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
  const people = await listPeople(treeId, q?.trim() || undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name…"
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            Search
          </button>
        </form>
        {canEdit(ctx.role) && (
          <Link
            href={`/trees/${treeId}/people/new`}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add person
          </Link>
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
                  <Link href={`/trees/${treeId}/people/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  {p.deceased && (
                    <span className="ml-2" title="Deceased" style={{ color: "var(--muted)" }}>†</span>
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
