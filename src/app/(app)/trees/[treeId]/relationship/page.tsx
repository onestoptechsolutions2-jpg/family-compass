import Link from "next/link";

import { loadTreeContext } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getTreeGraph } from "@/lib/queries/graph";
import { personOptions } from "@/lib/queries/people";
import { displayName, primaryName, NAME_SELECT } from "@/lib/person";
import { bloodRelationship } from "@/lib/kinship";
import { affinalRelationship } from "@/lib/affinity";
import { howConnected } from "@/lib/queries/connection";
import { PersonSelect } from "@/components/PersonSelect";
import { DeepSearchDialog } from "@/components/DeepSearchDialog";

export const metadata = { title: "Relationship check" };

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
  let connection: React.ReactNode = null;
  if (a && b && a !== b) {
    const conn = await howConnected(a, b);
    if (conn.found && conn.hops.length > 0) {
      connection = (
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h2 className="font-medium">How they&apos;re connected</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Through the circle — friends, mentors, chosen family (not bloodline).
          </p>
          <ol className="mt-3 flex flex-col gap-1.5 text-sm">
            {conn.hops.map((h, i) => (
              <li key={i}>
                <strong>{h.fromName}</strong>{" "}
                <span style={{ color: "var(--muted)" }}>
                  — {h.relation.replace(/-/g, " ")}
                  {h.otherFamily ? ` · from the ${h.otherFamily}` : ""} →
                </span>{" "}
                <strong>{h.toName}</strong>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {conn.hops.length} step{conn.hops.length === 1 ? "" : "s"} apart in the social graph.
          </p>
        </div>
      );
    }

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
            <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              <p>
                Only records in this tree were checked. For a check across other families and clans,
                run a deep search.
              </p>
              <div className="mt-2">
                <DeepSearchDialog
                  label="Deep search across families"
                  buttonClass="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  prefill={{
                    name: primaryName(pb.names)?.surname ?? primaryName(pb.names)?.first ?? nameB,
                    clan: pb.clan?.name ?? undefined,
                  }}
                />
              </div>
            </div>
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
        <h1 className="text-lg font-semibold">Are we related — and how are we connected?</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Check two people for a shared bloodline or clan, and trace how they&apos;re linked through
          the circle (friends, mentors, chosen family — across families too).
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
      {connection}
    </div>
  );
}
