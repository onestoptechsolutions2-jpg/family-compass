import Link from "next/link";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createClan, deleteClan } from "./actions";

export const metadata = { title: "Clans" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function ClansPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const style = { borderColor: "var(--border)", background: "var(--bg)" };

  const clans = await db.clan.findMany({
    where: { treeId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      aka: true,
      community: true,
      totem: true,
      origin: true,
      _count: { select: { people: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Clans group lineages above the family. In most Kenyan communities you don&apos;t marry
        within your own clan — the <Link href={`/trees/${treeId}/relationship`} className="text-brand-600 hover:underline">relationship check</Link> uses this.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clans.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-start justify-between">
              <div className="font-medium">{c.name}</div>
              {editable && (
                <form action={deleteClan.bind(null, treeId, c.id)}>
                  <button className="text-xs text-red-600 hover:underline">delete</button>
                </form>
              )}
            </div>
            <div style={{ color: "var(--muted)" }}>
              {c._count.people} people
              {c.community ? ` · ${c.community}` : ""}
              {c.totem ? ` · totem: ${c.totem}` : ""}
            </div>
            {c.aka && <div style={{ color: "var(--muted)" }}>a.k.a. {c.aka}</div>}
            {c.origin && <div style={{ color: "var(--muted)" }}>origin: {c.origin}</div>}
          </div>
        ))}
        {clans.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No clans yet.
          </p>
        )}
      </div>

      {editable && (
        <form
          action={createClan.bind(null, treeId)}
          className="grid max-w-2xl gap-3 rounded-xl border p-4 sm:grid-cols-2"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h2 className="font-medium sm:col-span-2">Add a clan</h2>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Name</span>
            <input name="name" required className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Also known as</span>
            <input name="aka" className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Community</span>
            <input name="community" placeholder="e.g. Luhya, Kikuyu, Luo" className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Totem</span>
            <input name="totem" className={field} style={style} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span style={{ color: "var(--muted)" }}>Origin / notes</span>
            <input name="origin" className={field} style={style} />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Add clan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
