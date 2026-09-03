import Link from "next/link";
import { notFound } from "next/navigation";

import { requireTreeManage } from "@/lib/rbac";
import { db } from "@/lib/db";
import { displayName, NAME_SELECT } from "@/lib/person";
import { matchIdentityCandidates } from "@/lib/identity";
import { requiredTreesForMerge } from "@/lib/identity-merge";
import { pendingMarriageLinksFor } from "@/lib/identity-relationships";
import {
  proposeMergeAction,
  approveMergeAction,
  rejectMergeAction,
  revertMergeAction,
  decideMarriageLinkAction,
} from "./actions";

export const metadata = { title: "Identity merges" };

export default async function MergesPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ dup?: string; name?: string; clan?: string; community?: string; region?: string; birthYear?: string }>;
}) {
  const { treeId } = await params;
  const sp = await searchParams;
  const ctx = await requireTreeManage(treeId).catch(() => null);
  if (!ctx) notFound();

  const people = await db.person.findMany({
    where: { treeId },
    select: { id: true, names: { select: NAME_SELECT } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const pendingMarriageLinks = await pendingMarriageLinksFor(treeId);
  const identityLabel = (identity: (typeof pendingMarriageLinks)[number]["aIdentity"]) =>
    identity.people[0] ? displayName(identity.people[0].names) : identity.displayName || "(unnamed)";

  // ---- step 2: searching for the duplicate's match elsewhere ----
  let search: {
    dupId: string;
    dupName: string;
    name: string;
    clan: string;
    community: string;
    region: string;
    birthYear: string;
    candidates: Awaited<ReturnType<typeof matchIdentityCandidates>>;
  } | null = null;

  if (sp.dup) {
    const dupPerson = await db.person.findFirst({
      where: { id: sp.dup, treeId },
      select: {
        id: true,
        identityId: true,
        names: { select: NAME_SELECT },
        clan: { select: { name: true } },
        tree: { select: { community: true, region: true } },
        eventRefs: {
          where: { event: { is: { type: "Birth" } } },
          select: { event: { select: { dateYear: true } } },
          take: 1,
        },
      },
    });
    if (dupPerson) {
      const dupName = displayName(dupPerson.names);
      const name = sp.name ?? dupName;
      const clan = sp.clan ?? dupPerson.clan?.name ?? "";
      const community = sp.community ?? dupPerson.tree.community ?? "";
      const region = sp.region ?? dupPerson.tree.region ?? "";
      const birthYear = sp.birthYear ?? String(dupPerson.eventRefs[0]?.event.dateYear ?? "");

      const raw = await matchIdentityCandidates({
        name,
        clan: clan || undefined,
        community: community || undefined,
        region: region || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
      }).catch(() => []);
      const candidates = raw.filter(
        (c) => c.treeId !== treeId && (!dupPerson.identityId || c.identityId !== dupPerson.identityId),
      );

      search = { dupId: dupPerson.id, dupName, name, clan, community, region, birthYear, candidates };
    }
  }

  // Every Identity this tree touches, then every merge request that names
  // one of them on either side — see docs/identity-dedup-claim-workflow.md.
  const linkedIdentities = await db.person.findMany({
    where: { treeId, identityId: { not: null } },
    select: { identityId: true },
    distinct: ["identityId"],
  });
  const identityIds = linkedIdentities.map((p) => p.identityId!).filter(Boolean);

  const requests = identityIds.length
    ? await db.identityMergeRequest.findMany({
        where: { OR: [{ fromIdentityId: { in: identityIds } }, { intoIdentityId: { in: identityIds } }] },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          status: true,
          evidence: true,
          createdAt: true,
          executedAt: true,
          revertibleUntil: true,
          fromIdentityId: true,
          intoIdentityId: true,
          proposedBy: { select: { name: true, email: true } },
          approvals: { select: { treeId: true, approvedById: true } },
          fromIdentity: { select: { displayName: true, people: { take: 1, select: { names: { select: NAME_SELECT } } } } },
          intoIdentity: { select: { displayName: true, people: { take: 1, select: { names: { select: NAME_SELECT } } } } },
        },
      })
    : [];

  const withRequired = await Promise.all(
    requests.map(async (r) => ({ r, required: await requiredTreesForMerge(r.fromIdentityId) })),
  );

  const label = (identity: (typeof requests)[number]["fromIdentity"]) =>
    identity.people[0] ? displayName(identity.people[0].names) : identity.displayName || "(unnamed)";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Identity merges</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          When the same real person turns up as two separate profiles — yours and a relative&apos;s
          tree — propose a merge here. Every family with a linked profile must sign off before
          anything changes, and it can be undone for 14 days after. See{" "}
          <span className="font-mono text-xs">docs/identity-dedup-claim-workflow.md</span>.
        </p>
      </div>

      <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <h3 className="text-sm font-medium">Propose a merge</h3>

        <form method="get" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex-1">
            <span style={{ color: "var(--muted)" }}>The duplicate — a profile in this tree</span>
            <select
              name="dup"
              required
              defaultValue={search?.dupId ?? ""}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <option value="">Choose a profile…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p.names)}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border px-4 py-2 font-medium" style={{ borderColor: "var(--border)" }}>
            Search for their match
          </button>
        </form>

        {search && (
          <div className="mt-4 flex flex-col gap-3">
            <form method="get" className="flex flex-wrap items-end gap-2 text-xs">
              <input type="hidden" name="dup" value={search.dupId} />
              <label>
                <span style={{ color: "var(--muted)" }}>Name</span>
                <input name="name" defaultValue={search.name} className="mt-1 block rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
              </label>
              <label>
                <span style={{ color: "var(--muted)" }}>Clan</span>
                <input name="clan" defaultValue={search.clan} className="mt-1 block w-28 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
              </label>
              <label>
                <span style={{ color: "var(--muted)" }}>Community</span>
                <input name="community" defaultValue={search.community} className="mt-1 block w-28 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
              </label>
              <label>
                <span style={{ color: "var(--muted)" }}>Region</span>
                <input name="region" defaultValue={search.region} className="mt-1 block w-28 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
              </label>
              <label>
                <span style={{ color: "var(--muted)" }}>Birth year</span>
                <input name="birthYear" defaultValue={search.birthYear} inputMode="numeric" className="mt-1 block w-20 rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
              </label>
              <button className="rounded-md border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
                Refine search
              </button>
            </form>

            {search.candidates.length === 0 && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No matches for &quot;{search.name}&quot; in other trees. You can still propose a merge by
                pasting a profile id directly, below.
              </p>
            )}

            {search.candidates.map((c) => (
              <div key={c.personId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase"
                      style={{ background: "var(--bg)", color: c.tier === "likely" ? "#16a34a" : "var(--muted)" }}
                    >
                      {c.tier === "likely" ? "likely match" : "possible match"}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {[c.treeName, c.clan && `${c.clan} clan`, c.community, c.birthYear && `b. ${c.birthYear}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <form action={proposeMergeAction.bind(null, treeId)}>
                  <input type="hidden" name="duplicatePersonId" value={search.dupId} />
                  <input type="hidden" name="correctPersonId" value={c.personId} />
                  <input type="hidden" name="evidence" value={`Matched via search: ${search.dupName} ↔ ${c.name} (score ${c.score})`} />
                  <button className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                    Propose merge
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs" style={{ color: "var(--muted)" }}>
            Know the other profile&apos;s id already? Propose directly →
          </summary>
          <form action={proposeMergeAction.bind(null, treeId)} className="mt-3 flex flex-col gap-3 text-sm">
            <label>
              <span style={{ color: "var(--muted)" }}>The duplicate — a profile in this tree</span>
              <select
                name="duplicatePersonId"
                required
                defaultValue={search?.dupId ?? ""}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <option value="">Choose a profile…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p.names)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ color: "var(--muted)" }}>The correct one — paste the other profile&apos;s id</span>
              <input
                name="correctPersonId"
                required
                placeholder="from their profile URL: /trees/…/people/<this part>"
                className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              />
            </label>
            <label>
              <span style={{ color: "var(--muted)" }}>Why you think they&apos;re the same person (optional)</span>
              <textarea
                name="evidence"
                rows={2}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              />
            </label>
            <button className="self-start rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Propose merge
            </button>
          </form>
        </details>
      </section>

      {pendingMarriageLinks.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Family connections waiting on this tree ({pendingMarriageLinks.length})
          </h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Another family recorded a marriage that connects to someone here. Confirming shares a
            read-only view of that marriage and its children both ways — neither tree&apos;s own
            data changes, and each keeps its own privacy and editors.
          </p>
          {pendingMarriageLinks.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div>
                <span className="font-medium">{identityLabel(r.aIdentity)}</span>
                <span style={{ color: "var(--muted)" }}> married to </span>
                <span className="font-medium">{identityLabel(r.bIdentity)}</span>
              </div>
              <div className="mt-1" style={{ color: "var(--muted)" }}>
                proposed from {r.sourceTreeName ?? "another tree"} · {r.createdAt.toISOString().slice(0, 10)}
              </div>
              <div className="mt-3 flex gap-2">
                <form action={decideMarriageLinkAction.bind(null, treeId, r.id, "confirm")}>
                  <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
                    Confirm
                  </button>
                </form>
                <form action={decideMarriageLinkAction.bind(null, treeId, r.id, "dispute")}>
                  <button className="rounded-md border px-3 py-1.5 text-red-600" style={{ borderColor: "var(--border)" }}>
                    Dispute
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Requests involving this tree ({withRequired.length})
        </h3>
        {withRequired.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Nothing here.</p>
        )}
        {withRequired.map(({ r, required }) => {
          const approvedTreeIds = new Set(r.approvals.map((a) => a.treeId));
          const thisTreeRequired = required.some((t) => t.treeId === treeId);
          const thisTreeApproved = approvedTreeIds.has(treeId);
          const open = r.status === "PROPOSED" || r.status === "CORROBORATING";
          const canRevert =
            r.status === "EXECUTED" &&
            r.revertibleUntil &&
            r.revertibleUntil.getTime() > Date.now() &&
            r.approvals.some((a) => a.approvedById === ctx.user.id);

          return (
            <div key={r.id} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{label(r.fromIdentity)}</span>
                  <span style={{ color: "var(--muted)" }}> → merges into </span>
                  <span className="font-medium">{label(r.intoIdentity)}</span>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: "var(--bg)",
                    color:
                      r.status === "EXECUTED" ? "#16a34a" : r.status === "REJECTED" ? "#dc2626" : "var(--muted)",
                  }}
                >
                  {r.status.toLowerCase()}
                </span>
              </div>

              <div className="mt-1" style={{ color: "var(--muted)" }}>
                proposed by {r.proposedBy.name ?? r.proposedBy.email} ·{" "}
                {r.createdAt.toISOString().slice(0, 10)}
              </div>
              {r.evidence && <p className="mt-1">“{r.evidence}”</p>}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {required.map((t) => (
                  <span
                    key={t.treeId}
                    className="rounded-full border px-2 py-0.5 text-xs"
                    style={{
                      borderColor: "var(--border)",
                      color: approvedTreeIds.has(t.treeId) ? "#16a34a" : "var(--muted)",
                    }}
                  >
                    {approvedTreeIds.has(t.treeId) ? "✓ " : "· "}
                    {t.treeName}
                  </span>
                ))}
              </div>

              {open && thisTreeRequired && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {!thisTreeApproved && (
                    <form action={approveMergeAction.bind(null, treeId, r.id)}>
                      <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
                        Approve for this tree
                      </button>
                    </form>
                  )}
                  <form action={rejectMergeAction.bind(null, treeId, r.id)} className="flex items-end gap-1">
                    <input
                      name="reason"
                      placeholder="reason (optional)"
                      className="w-40 rounded-md border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                    />
                    <button className="rounded-md border px-2 py-1 text-red-600" style={{ borderColor: "var(--border)" }}>
                      Reject
                    </button>
                  </form>
                </div>
              )}

              {canRevert && (
                <form action={revertMergeAction.bind(null, treeId, r.id)} className="mt-3">
                  <button className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)" }}>
                    Undo this merge (window ends {r.revertibleUntil!.toISOString().slice(0, 10)})
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        <Link href={`/trees/${treeId}/claims`} className="hover:underline">
          ← Back to claims
        </Link>
      </p>
    </div>
  );
}
