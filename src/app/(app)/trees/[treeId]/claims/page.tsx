import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";

import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { displayName, genderColor, genderSymbol } from "@/lib/person";
import { displayPhone, waLink } from "@/lib/wa";
import { claimStatusReport, CLAIM_CATEGORIES } from "@/lib/queries/claim-report";
import { CopyButton } from "@/components/CopyButton";
import { approveClaimAction, rejectClaimAction, sendClaimLink } from "./actions";

export const metadata = { title: "Claims" };

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

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role)) notFound();

  const accounts = await claimStatusReport(treeId);

  const claims = await db.personClaim.findMany({
    where: { treeId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      claimantName: true,
      phone: true,
      note: true,
      code: true,
      status: true,
      rejectionReason: true,
      signInToken: true,
      createdAt: true,
      person: { select: { id: true, names: { select: NAME_SELECT } } },
    },
  });

  const origin = await publicOrigin();
  const pending = claims.filter((c) => c.status === "PENDING");
  const rest = claims.filter((c) => c.status !== "PENDING");

  const Card = ({ c }: { c: (typeof claims)[number] }) => {
    const target = c.person ? displayName(c.person.names) : "wants to join the tree";
    const signInUrl = c.signInToken ? `${origin}/api/auth/wa/${c.signInToken}` : null;
    return (
      <div
        className="rounded-xl border p-4 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-medium">{c.claimantName}</span>{" "}
            <span style={{ color: "var(--muted)" }}>
              → {c.person ? "claims " : ""}
              {c.person ? (
                <Link href={`/trees/${treeId}/people/${c.person.id}`} className="hover:underline">
                  {target}
                </Link>
              ) : (
                target
              )}
            </span>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              background: "var(--bg)",
              color:
                c.status === "APPROVED"
                  ? "#16a34a"
                  : c.status === "REJECTED"
                    ? "#dc2626"
                    : "var(--muted)",
            }}
          >
            {c.status.toLowerCase()}
          </span>
        </div>
        <div className="mt-1" style={{ color: "var(--muted)" }}>
          {displayPhone(c.phone)} · code <span className="font-mono">{c.code}</span> ·{" "}
          {c.createdAt.toISOString().slice(0, 16).replace("T", " ")}
        </div>
        {c.note && <p className="mt-1">“{c.note}”</p>}
        {c.rejectionReason && <p className="mt-1 text-red-600">Rejected: {c.rejectionReason}</p>}

        {c.status === "PENDING" && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <form action={approveClaimAction.bind(null, treeId, c.id)} className="flex items-end gap-2">
              <label className="text-xs">
                <span style={{ color: "var(--muted)" }}>Role</span>
                <select
                  name="role"
                  defaultValue={Role.CONTRIBUTOR}
                  className="ml-1 rounded-md border px-2 py-1"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <option value={Role.CONTRIBUTOR}>contributor</option>
                  <option value={Role.EDITOR}>editor</option>
                  <option value={Role.VIEWER}>viewer</option>
                </select>
              </label>
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
                Approve
              </button>
            </form>
            <form action={rejectClaimAction.bind(null, treeId, c.id)} className="flex items-end gap-1">
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

        {c.status === "APPROVED" && signInUrl && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={waLink(
                c.phone,
                `You're in the "${ctx.tree.name}" family tree. Open this to sign in: ${signInUrl}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Send sign-in link on WhatsApp
            </a>
            <code className="truncate rounded bg-black/5 px-1.5 py-0.5 text-xs">{signInUrl}</code>
            <CopyButton value={signInUrl} label="Copy link" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Claims &amp; join requests</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          People who opened a share link and asked to be an existing person (or to be added).
          Verify the WhatsApp message you received, then approve — that links their sign-in to the
          existing record, so no duplicate is created.
        </p>
      </div>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Pending ({pending.length})
        </h3>
        <div className="mt-2 flex flex-col gap-2">
          {pending.map((c) => (
            <Card key={c.id} c={c} />
          ))}
          {pending.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Nothing waiting.
            </p>
          )}
        </div>
      </section>

      {rest.length > 0 && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Recent
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {rest.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      <section id="accounts" className="flex scroll-mt-4 flex-col gap-3 border-t pt-6" style={{ borderColor: "var(--border)" }}>
        <div>
          <h3 className="text-lg font-semibold">Account claims</h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Every profile in the tree, bucketed by whether it&apos;s tied to a login, has a link out,
            or is still open. Send a claim link straight from here — it goes to the owner, they
            confirm, a manager approves.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CLAIM_CATEGORIES.map((c) => (
            <a
              key={c.id}
              href={`#account-${c.id}`}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="text-2xl font-semibold">{accounts.counts[c.id]}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</div>
            </a>
          ))}
        </div>

        {CLAIM_CATEGORIES.filter((c) => accounts.rows[c.id].length > 0).map((c) => (
          <div
            key={c.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <h4 id={`account-${c.id}`} className="scroll-mt-4 font-medium">
              {c.label} · {accounts.counts[c.id]}
            </h4>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{c.hint}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {accounts.rows[c.id].map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/trees/${treeId}/people/${r.id}`} className="font-medium hover:underline">
                    {genderSymbol(r.gender) && (
                      <span className="mr-1" style={{ color: genderColor(r.gender) }}>{genderSymbol(r.gender)}</span>
                    )}
                    {r.name}
                  </Link>
                  {r.category === "claimed" && r.claimedByName && (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>· {r.claimedByName}</span>
                  )}
                  {r.inviteToken && (
                    <span className="flex items-center gap-1.5 text-xs">
                      <code className="rounded bg-black/5 px-1.5 py-0.5">{origin}/claim/{r.inviteToken}</code>
                      <CopyButton value={`${origin}/claim/${r.inviteToken}`} label="Copy" />
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Hi ${r.name} — this is your profile on our family tree. Confirm it's you: ${origin}/claim/${r.inviteToken}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded px-1.5 py-0.5 font-medium text-white"
                        style={{ background: "#25D366" }}
                      >
                        WhatsApp
                      </a>
                    </span>
                  )}
                  {(r.category === "claimable" || r.category === "invited") && (
                    <form action={sendClaimLink.bind(null, treeId, r.id)}>
                      <button className="rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>
                        {r.category === "invited" ? "New link" : "Send claim link"}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
