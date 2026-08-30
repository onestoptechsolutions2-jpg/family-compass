import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getTreeGraph } from "@/lib/queries/graph";
import { personOptions } from "@/lib/queries/people";
import { displayName } from "@/lib/person";
import { bloodRelationship } from "@/lib/kinship";
import { affinalRelationship } from "@/lib/affinity";
import { PersonSelect } from "@/components/PersonSelect";

export const metadata = { title: "Relationship check" };

const NAME_SELECT = {
  first: true,
  surname: true,
  surnamePrefix: true,
  suffix: true,
  nick: true,
  title: true,
  preferred: true,
  type: true,
  order: true,
} as const;

export default async function RelationshipPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { treeId } = await params;
  const { a, b } = await searchParams;
  await loadTreeContext(treeId);
  const options = await personOptions(treeId);

  let result: React.ReactNode = null;
  if (a && b && a !== b) {
    const [pa, pb, graph] = await Promise.all([
      db.person.findFirst({
        where: { id: a, treeId },
        select: { id: true, names: { select: NAME_SELECT }, clan: { select: { name: true } } },
      }),
      db.person.findFirst({
        where: { id: b, treeId },
        select: { id: true, names: { select: NAME_SELECT }, clan: { select: { name: true } } },
      }),
      getTreeGraph(treeId, a),
    ]);

    if (pa && pb) {
      const k = bloodRelationship(graph, pa.id, pb.id);
      const sameClan =
        pa.clan && pb.clan && pa.clan.name.toLowerCase() === pb.clan.name.toLowerCase()
          ? pa.clan.name
          : null;
      const ancestor = k.commonAncestorId ? graph.persons[k.commonAncestorId]?.name : null;
      const close = k.related && k.closeness >= 0 && k.closeness <= 6;
      const aff = !k.related && !k.marriedToEachOther ? affinalRelationship(graph, pa.id, pb.id) : null;
      const nameA = displayName(pa.names);
      const nameB = displayName(pb.names);

      result = (
        <div
          className="rounded-xl border p-5"
          style={{
            borderColor: sameClan || close ? "#ef4444" : "var(--color-brand-600)",
            background: "var(--card)",
          }}
        >
          <h2 className="font-medium">
            {displayName(pa.names)} &amp; {displayName(pb.names)}
          </h2>

          {sameClan && (
            <p className="mt-2 text-sm text-red-600">
              ⚠ Same clan (<strong>{sameClan}</strong>). Customary rules in most communities
              discourage marriage within a clan.
            </p>
          )}

          {k.marriedToEachOther && (
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              These two are recorded as partners.
            </p>
          )}

          {k.related ? (
            <p className="mt-2 text-sm">
              <strong>{k.label}</strong>
              {ancestor ? (
                <>
                  {" "}
                  — they share <strong>{ancestor}</strong> (
                  {k.degreeA} up on one side, {k.degreeB} on the other).
                </>
              ) : null}
              {close && (
                <span className="text-red-600">
                  {" "}
                  This is a close blood relationship.
                </span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm">
              No blood relationship or shared clan found <em>in this tree</em>.
            </p>
          )}

          {aff?.found && (
            <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
              <p className="font-medium">Related by marriage</p>
              <p className="mt-1" style={{ color: "var(--muted)" }}>
                {aff.via.replace(/^A's /, `${nameA}'s `)}.
              </p>
              <ul className="mt-2 space-y-1">
                <li>
                  {nameA} → {nameB}:{" "}
                  <strong>{aff.aToB.en}</strong>
                  {aff.aToB.sw ? <span style={{ color: "var(--muted)" }}> ({aff.aToB.sw})</span> : null}
                </li>
                <li>
                  {nameB} → {nameA}:{" "}
                  <strong>{aff.bToA.en}</strong>
                  {aff.bToA.sw ? <span style={{ color: "var(--muted)" }}> ({aff.bToA.sw})</span> : null}
                </li>
              </ul>
              {aff.note && (
                <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{aff.note}</p>
              )}
            </div>
          )}

          {!k.related && !sameClan && (
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Only records in this tree were checked. For a check across other families and
              clans,{" "}
              <Link href="/discover" className="text-brand-600 hover:underline">
                run a deep search
              </Link>
              .
            </p>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
            Based on recorded genealogy only — not legal or medical advice.
          </p>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Are we related?</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Check two people for a shared bloodline or clan — e.g. before a relationship or
          marriage.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Person A</span>
          <div className="w-56">
            <PersonSelect name="a" options={options} defaultValue={a} allowEmpty={false} />
          </div>
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Person B</span>
          <div className="w-56">
            <PersonSelect name="b" options={options} defaultValue={b} allowEmpty={false} />
          </div>
        </label>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Check
        </button>
      </form>

      {result}
    </div>
  );
}
