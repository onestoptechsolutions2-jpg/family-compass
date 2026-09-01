import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "All trees" };

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

export default async function AdminTreesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const trees = await db.tree.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { workspace: { name: { contains: term, mode: "insensitive" } } },
            { workspace: { memberships: { some: { user: { email: { contains: term, mode: "insensitive" } } } } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      keeperUntil: true,
      discoverable: true,
      workspace: {
        select: {
          name: true,
          memberships: {
            where: { role: "OWNER" },
            take: 1,
            select: { user: { select: { name: true, email: true } } },
          },
        },
      },
      _count: { select: { people: true, families: true, media: true } },
    },
  });

  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">All trees ({trees.length})</h1>
        <form method="get" className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={term}
            placeholder="name, workspace, owner email…"
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 font-medium">Tree</th>
              <th className="px-3 py-2 font-medium">Workspace / owner</th>
              <th className="px-3 py-2 font-medium">People</th>
              <th className="px-3 py-2 font-medium">Families</th>
              <th className="px-3 py-2 font-medium">Media</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Directory</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {trees.map((t) => {
              const owner = t.workspace.memberships[0]?.user;
              const keeper = t.keeperUntil && t.keeperUntil.getTime() > now;
              return (
                <tr key={t.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <Link href={`/trees/${t.id}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {t.workspace.name}
                    {owner ? ` · ${owner.name ?? owner.email}` : ""}
                  </td>
                  <td className="px-3 py-2">{t._count.people}</td>
                  <td className="px-3 py-2">{t._count.families}</td>
                  <td className="px-3 py-2">{t._count.media}</td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {keeper ? `Family · to ${fmtDate(t.keeperUntil)}` : "Free"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {t.discoverable ? "listed" : "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {fmtDate(t.createdAt)}
                  </td>
                </tr>
              );
            })}
            {trees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No trees match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
