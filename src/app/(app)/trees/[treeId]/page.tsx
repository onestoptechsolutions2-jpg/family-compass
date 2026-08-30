import Link from "next/link";

import { db } from "@/lib/db";
import { loadTreeContext } from "@/lib/rbac";

export default async function TreeOverviewPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await loadTreeContext(treeId); // access check (cached from layout)

  const counts = await db.tree.findUniqueOrThrow({
    where: { id: treeId },
    select: {
      _count: {
        select: {
          people: true,
          families: true,
          events: true,
          places: true,
          sources: true,
          media: true,
          sharedViews: true,
        },
      },
    },
  });

  const stats: { href: string; label: string; count: number }[] = [
    { href: `/trees/${treeId}/people`, label: "People", count: counts._count.people },
    { href: `/trees/${treeId}/families`, label: "Families", count: counts._count.families },
    { href: `/trees/${treeId}/events`, label: "Events", count: counts._count.events },
    { href: `/trees/${treeId}/places`, label: "Places", count: counts._count.places },
    { href: `/trees/${treeId}/sources`, label: "Sources", count: counts._count.sources },
    { href: `/trees/${treeId}/media`, label: "Media", count: counts._count.media },
    { href: `/trees/${treeId}/sharing`, label: "Shared views", count: counts._count.sharedViews },
  ];

  const empty = counts._count.people === 0;

  return (
    <div className="flex flex-col gap-6">
      {empty && (
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h2 className="font-medium">This tree is empty</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Add your first person, or import an existing Gramps / GEDCOM file.
          </p>
          <div className="mt-3 flex gap-3">
            <Link
              href={`/trees/${treeId}/people/new`}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add a person
            </Link>
            <Link
              href={`/trees/${treeId}/import`}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              style={{ borderColor: "var(--border)" }}
            >
              Import a file
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border p-4 hover:shadow-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{s.count}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
