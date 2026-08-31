import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getUserWorkspaces } from "@/lib/queries/dashboard";
import { createTree } from "./actions";

export const metadata = { title: "Your trees" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ trees?: string }>;
}) {
  const user = await requireUser();
  const { trees: showTrees } = await searchParams;

  // A relative who claimed their own profile starts *as themselves*, centred
  // on their profile — not on this workspace list. `?trees=1` opts out.
  if (!showTrees) {
    const claimed = await db.person.findFirst({
      where: { claimedByUserId: user.id },
      select: { id: true, treeId: true },
    });
    if (claimed) redirect(`/trees/${claimed.treeId}/people/${claimed.id}`);
  }

  const workspaces = await getUserWorkspaces(user.id);
  const canCreateIn = workspaces.filter((w) => {
    const role = w.memberships[0]?.role;
    return role === Role.OWNER || role === Role.EDITOR;
  });

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl font-semibold">Your trees</h1>
        {workspaces.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            You don&apos;t belong to any workspace yet.
          </p>
        )}

        {workspaces.map((w) => (
          <div key={w.id} className="mt-6">
            <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {w.name}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {w.trees.map((t) => (
                <Link
                  key={t.id}
                  href={`/trees/${t.id}`}
                  className="rounded-xl border p-4 transition hover:shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    {t._count.people} people · {t._count.families} families
                  </div>
                </Link>
              ))}
              {w.trees.length === 0 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  No trees in this workspace yet.
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      {canCreateIn.length > 0 && (
        <section
          className="rounded-xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h2 className="font-medium">Create a new tree</h2>
          <form action={createTree} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm">
              <span style={{ color: "var(--muted)" }}>Name</span>
              <input
                name="name"
                required
                placeholder="The Ominde Family"
                className="mt-1 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span style={{ color: "var(--muted)" }}>Workspace</span>
              <select
                name="workspaceId"
                className="mt-1 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                {canCreateIn.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Create tree
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
