import Link from "next/link";

import { loadTreeContext, canEdit } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Dialog } from "@/components/Dialog";
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

  const [clans, refClans] = await Promise.all([
    db.clan.findMany({
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
    }),
    db.referenceClan.findMany({
      orderBy: [{ community: "asc" }, { name: "asc" }],
      select: { name: true, community: true },
    }),
  ]);
  const communities = [...new Set(refClans.map((r) => r.community))];

  const addClanForm = (
    <form action={createClan.bind(null, treeId)} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Name</span>
        <input name="name" required list="ref-clans" className={field} style={style} />
      </label>
      <datalist id="ref-clans">
        {refClans.map((r) => (
          <option key={`${r.community}-${r.name}`} value={r.name}>
            {r.community}
          </option>
        ))}
      </datalist>
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Also known as</span>
        <input name="aka" className={field} style={style} />
      </label>
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Community</span>
        <input name="community" list="ref-communities" placeholder="e.g. Luhya, Kikuyu, Luo" className={field} style={style} />
      </label>
      <datalist id="ref-communities">
        {communities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
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
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-sm" style={{ color: "var(--muted)" }}>
          Clans group lineages above the family. In most Kenyan communities you don&apos;t marry
          within your own clan — the <Link href={`/trees/${treeId}/relationship`} className="text-brand-600 hover:underline">relationship check</Link> uses this.
        </p>
        {editable && (
          <Dialog title="Add a clan" label="＋ Add clan" wide buttonClass="shrink-0 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            {addClanForm}
          </Dialog>
        )}
      </div>

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

    </div>
  );
}
