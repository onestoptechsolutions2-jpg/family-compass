import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { getPersonDetail, getPersonRelations } from "@/lib/queries/people";
import { displayName } from "@/lib/person";
import { formatDate, dateSortKey } from "@/lib/date";
import { PersonChip } from "@/components/PersonChip";
import { deletePerson } from "../actions";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ treeId: string; personId: string }>;
}) {
  const { treeId, personId } = await params;
  const ctx = await loadTreeContext(treeId);
  const person = await getPersonDetail(treeId, personId);
  if (!person) notFound();
  const relations = await getPersonRelations(treeId, personId);
  const editable = canEdit(ctx.role);

  const events = [...person.eventRefs]
    .map((r) => r.event)
    .sort((a, b) => dateSortKey(a).localeCompare(dateSortKey(b)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/trees/${treeId}/people`}
            className="text-sm hover:underline"
            style={{ color: "var(--muted)" }}
          >
            ← People
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">{displayName(person.names)}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {person.gender.toLowerCase()}
            {person.living ? " · living" : ""}
            {person.grampsId ? ` · ${person.grampsId}` : ""}
          </p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Link
              href={`/trees/${treeId}/people/${personId}/edit`}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              Edit
            </Link>
            <form action={deletePerson.bind(null, treeId, personId)}>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm text-red-600"
                style={{ borderColor: "var(--border)" }}
              >
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h3 className="font-medium">Timeline</h3>
          {events.length === 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              No events recorded.
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-28 shrink-0" style={{ color: "var(--muted)" }}>
                  {formatDate(e) || "—"}
                </span>
                <span>
                  <span className="font-medium">{e.type}</span>
                  {e.place ? ` · ${e.place.title}` : ""}
                  {e.description ? ` — ${e.description}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <h3 className="font-medium">Parents</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {relations?.parents.length
                ? relations.parents.map((p) => <PersonChip key={p.id} person={p} treeId={treeId} />)
                : <span className="text-sm" style={{ color: "var(--muted)" }}>Not recorded</span>}
            </div>
            {relations?.siblings.length ? (
              <>
                <h4 className="mt-3 text-sm font-medium">Siblings</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {relations.siblings.map((p) => (
                    <PersonChip key={p.id} person={p} treeId={treeId} />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Partners &amp; children</h3>
              {editable && (
                <Link
                  href={`/trees/${treeId}/families/new?partner=${personId}`}
                  className="text-xs text-brand-600 hover:underline"
                >
                  + family
                </Link>
              )}
            </div>
            {relations?.families.length
              ? relations.families.map((f) => (
                  <div key={f.id} className="mt-3">
                    <div className="flex items-center gap-2">
                      <PersonChip person={f.spouse} treeId={treeId} />
                      <Link
                        href={`/trees/${treeId}/families/${f.id}`}
                        className="text-xs hover:underline"
                        style={{ color: "var(--muted)" }}
                      >
                        open family
                      </Link>
                    </div>
                    {f.children.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 pl-4">
                        {f.children.map((c) => (
                          <PersonChip key={c.id} person={c} treeId={treeId} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              : (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  None recorded.
                </p>
              )}
          </div>
        </div>
      </section>
    </div>
  );
}
