import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessError, loadTreeContext } from "@/lib/rbac";
import { db } from "@/lib/db";

export default async function TreeHomePage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;

  let ctx;
  try {
    ctx = await loadTreeContext(treeId);
  } catch (err) {
    if (err instanceof AccessError && err.status === 404) notFound();
    throw err;
  }

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
        },
      },
    },
  });

  const sections: { href: string; label: string; count?: number }[] = [
    { href: `/trees/${treeId}/people`, label: "People", count: counts._count.people },
    { href: `/trees/${treeId}/families`, label: "Families", count: counts._count.families },
    { href: `/trees/${treeId}/events`, label: "Events", count: counts._count.events },
    { href: `/trees/${treeId}/places`, label: "Places", count: counts._count.places },
    { href: `/trees/${treeId}/sources`, label: "Sources", count: counts._count.sources },
    { href: `/trees/${treeId}/media`, label: "Media", count: counts._count.media },
    { href: `/trees/${treeId}/tree`, label: "Interactive tree" },
    { href: `/trees/${treeId}/charts`, label: "Charts & exports" },
    { href: `/trees/${treeId}/sharing`, label: "Sharing" },
    { href: `/trees/${treeId}/settings`, label: "Settings" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
            ← All trees
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{ctx.tree.name}</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {ctx.workspace.name} · your role: {ctx.role.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border p-4 hover:shadow-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="font-medium">{s.label}</div>
            {typeof s.count === "number" && (
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {s.count}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
