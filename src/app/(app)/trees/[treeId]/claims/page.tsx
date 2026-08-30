import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";

import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { displayName } from "@/lib/person";
import { displayPhone, waLink } from "@/lib/wa";
import { CopyButton } from "@/components/CopyButton";
import { approveClaimAction, rejectClaimAction } from "./actions";

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
    </div>
  );
}
