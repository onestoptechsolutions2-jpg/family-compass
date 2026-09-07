import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { chamaEnabled } from "@/lib/chama/plugin";
import { db } from "@/lib/db";
import { listChamasForTree } from "@/lib/chama";
import { createChamaGroup, joinChamaGroup, leaveChamaGroup } from "./actions";

export const metadata = { title: "Family groups" };

const PURPOSE_LABEL: Record<string, string> = {
  WELFARE: "Welfare",
  SAVINGS: "Savings circle",
  MERRY_GO_ROUND: "Merry-go-round",
  TABLE_BANKING: "Table banking",
};

export default async function ChamaGroupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ suggest?: string }>;
}) {
  const { treeId } = await params;
  const { suggest } = await searchParams;
  if (!chamaEnabled()) notFound();
  const ctx = await loadTreeContext(treeId);
  const manages = canManageTree(ctx.role);

  const [groups, me] = await Promise.all([
    listChamasForTree(treeId),
    db.person.findFirst({ where: { treeId, claimedByUserId: ctx.user.id }, select: { id: true } }),
  ]);
  const myPersonId = me?.id ?? null;
  const memberships = myPersonId
    ? await db.chamaMember.findMany({
        where: { personId: myPersonId, active: true, chama: { treeId } },
        select: { chamaId: true },
      })
    : [];
  const joinedIds = new Set(memberships.map((m) => m.chamaId));

  const card = { borderColor: "var(--border)", background: "var(--card)" };
  const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
  const style = { borderColor: "var(--border)", background: "var(--bg)" };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Family groups</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Savings circles, merry-go-rounds and welfare groups scoped to this family — e.g. one
          for a generation, or the whole family&apos;s welfare fund. Joining is self-service; anyone
          with a claimed profile here can join or leave a group themselves.
        </p>
      </div>

      {!myPersonId && (
        <p className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          Claim your profile in this tree to join a group.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border p-4" style={card}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{g.name}</h2>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {PURPOSE_LABEL[g.purpose] ?? g.purpose} · {g._count.members}{" "}
                  {g._count.members === 1 ? "member" : "members"}
                </p>
              </div>
              {myPersonId &&
                (joinedIds.has(g.id) ? (
                  <form action={leaveChamaGroup.bind(null, treeId, g.id)}>
                    <button className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)" }}>
                      Leave
                    </button>
                  </form>
                ) : (
                  <form action={joinChamaGroup.bind(null, treeId, g.id)}>
                    <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                      Join
                    </button>
                  </form>
                ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No groups yet.
          </p>
        )}
      </div>

      {manages && (
        <form action={createChamaGroup.bind(null, treeId)} className="rounded-xl border p-4" style={card}>
          <h2 className="font-medium">Start a group</h2>
          <label className="mt-3 block text-sm">
            <span style={{ color: "var(--muted)" }}>Name</span>
            <input
              name="name"
              required
              defaultValue={suggest ?? ""}
              placeholder="e.g. Gen Z — Otieno Family"
              className={field}
              style={style}
            />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Purpose</span>
            <select name="purpose" defaultValue="SAVINGS" className={field} style={style}>
              <option value="SAVINGS">Savings circle</option>
              <option value="WELFARE">Welfare</option>
              <option value="MERRY_GO_ROUND">Merry-go-round</option>
              <option value="TABLE_BANKING">Table banking</option>
            </select>
          </label>
          <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create group
          </button>
        </form>
      )}

      <Link href={`/trees/${treeId}/chama`} className="text-xs hover:underline" style={{ color: "var(--link)" }}>
        Manage the external Chama platform link →
      </Link>
    </div>
  );
}
