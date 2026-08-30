import { notFound } from "next/navigation";
import { Role, ShareMode } from "@prisma/client";

import { loadTreeContext, canManageTree, canManageWorkspace } from "@/lib/rbac";
import { publicOrigin } from "@/lib/origin";
import { db } from "@/lib/db";
import { getWorkspaceCollab, listSharedViews } from "@/lib/queries/members";
import { personOptions } from "@/lib/queries/people";
import { formatName } from "@/lib/person";
import { displayPhone } from "@/lib/wa";
import { CopyButton } from "@/components/CopyButton";
import { PersonSelect } from "@/components/PersonSelect";
import {
  inviteMember,
  revokeInvite,
  changeMemberRole,
  removeMember,
  createSharedView,
  revokeSharedView,
  deleteSharedView,
  toggleSharedViewClaims,
  updateClaimSettings,
} from "./actions";

export const metadata = { title: "Sharing" };

export default async function SharingPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role)) notFound();

  const origin = await publicOrigin();
  const [collab, shares, options, treeRow] = await Promise.all([
    getWorkspaceCollab(ctx.workspace.id, ctx.user.id),
    listSharedViews(treeId),
    personOptions(treeId),
    db.tree.findUniqueOrThrow({
      where: { id: treeId },
      select: { contactWhatsapp: true, claimPinHash: true },
    }),
  ]);
  const isOwner = canManageWorkspace(ctx.role);
  const roleValues = Object.values(Role);

  return (
    <div className="flex flex-col gap-8">
      {/* ---------------- Members ---------------- */}
      <section>
        <h2 className="text-lg font-semibold">People with access</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Members can see everything in this workspace. Roles: viewer (read-only), contributor
          (add/edit records), editor (also imports &amp; sharing), owner (full control).
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <tbody>
              {collab.members.map((m) => (
                <tr key={m.membershipId} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {m.name ?? m.email}
                      {m.isSelf && <span style={{ color: "var(--muted)" }}> (you)</span>}
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {m.email}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <form action={changeMemberRole.bind(null, treeId, m.membershipId)}>
                      <select
                        name="role"
                        defaultValue={m.role}
                        disabled={!isOwner && m.role === Role.OWNER}
                        className="rounded-md border px-2 py-1 text-xs"
                        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                      >
                        {roleValues.map((r) => (
                          <option key={r} value={r}>
                            {r.toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <button className="ml-2 rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                        save
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isOwner && !m.isSelf && (
                      <form action={removeMember.bind(null, treeId, m.membershipId)}>
                        <button className="text-xs text-red-600 hover:underline">remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={inviteMember.bind(null, treeId)}
          className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Invite by email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="relative@example.com"
              className="mt-1 block rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Role</span>
            <select
              name="role"
              defaultValue={Role.CONTRIBUTOR}
              className="mt-1 block rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            >
              {roleValues
                .filter((r) => r !== Role.OWNER || isOwner)
                .map((r) => (
                  <option key={r} value={r}>
                    {r.toLowerCase()}
                  </option>
                ))}
            </select>
          </label>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Send invite
          </button>
        </form>

        {collab.invites.length > 0 && (
          <div className="mt-3">
            <h3 className="text-sm font-medium">Pending invitations</h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {collab.invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2">
                  <span>{i.email}</span>
                  <span style={{ color: "var(--muted)" }}>· {i.role.toLowerCase()}</span>
                  {i.expired && <span className="text-red-600">· expired</span>}
                  <form action={revokeInvite.bind(null, treeId, i.id)}>
                    <button className="text-xs text-red-600 hover:underline">revoke</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------------- Self-service claims ---------------- */}
      <section>
        <h2 className="text-lg font-semibold">Self-service onboarding (WhatsApp)</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          When a shared view has <em>claims</em> on, a visitor can find their own node, tap
          “This is me”, and confirm to your WhatsApp below. You approve in{" "}
          <span className="font-medium">Claims</span> — their sign-in links to the existing
          record, so nobody gets duplicated. Set a family word if the link may spread beyond
          relatives.
        </p>
        <form
          action={updateClaimSettings.bind(null, treeId)}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your WhatsApp number</span>
            <input
              name="contactWhatsapp"
              defaultValue={treeRow.contactWhatsapp ? displayPhone(treeRow.contactWhatsapp) : ""}
              placeholder="07XX XXX XXX"
              className="mt-1 block rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>
              Family word {treeRow.claimPinHash ? "(set — leave blank to keep)" : "(optional)"}
            </span>
            <input
              name="familyWord"
              placeholder={treeRow.claimPinHash ? "••••••" : "e.g. mukhwa"}
              className="mt-1 block rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          {treeRow.claimPinHash && (
            <label className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
              <input type="checkbox" name="clearFamilyWord" value="true" /> remove word
            </label>
          )}
          <button className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            Save
          </button>
        </form>
      </section>

      {/* ---------------- Shared links ---------------- */}
      <section>
        <h2 className="text-lg font-semibold">Public shared views</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          A read-only, pan-and-zoom tree centered on one person — no account needed to view.
          Living people are shown as “Living &lt;surname&gt;” unless you opt in. Private people
          are always hidden.
        </p>

        <form
          action={createSharedView.bind(null, treeId)}
          className="mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <label className="text-sm sm:col-span-2">
            <span style={{ color: "var(--muted)" }}>Center on</span>
            <PersonSelect
              name="centralPersonId"
              options={options}
              defaultValue={ctx.tree.homePersonId}
              allowEmpty={false}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Title (optional)</span>
            <input
              name="title"
              placeholder="The Ominde Family"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Layout</span>
            <select
              name="mode"
              defaultValue={ShareMode.HOURGLASS}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            >
              {Object.values(ShareMode).map((m) => (
                <option key={m} value={m}>
                  {m.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Generations</span>
            <input
              type="number"
              name="generations"
              min={2}
              max={6}
              defaultValue={4}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Password (optional)</span>
            <input
              name="password"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="includeLiving" value="true" />
            Show living people in full
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowClaims" value="true" />
            Let visitors claim their own profile
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Expires in days (0 = never)</span>
            <input
              type="number"
              name="expiresInDays"
              min={0}
              defaultValue={0}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Create shared link
            </button>
          </div>
        </form>

        <ul className="mt-4 flex flex-col gap-2">
          {shares.map((s) => {
            const url = `${origin}/s/${s.slug}`;
            const central = formatName(
              s.centralPerson.names.find((n) => n.preferred) ??
                s.centralPerson.names.find((n) => n.type === "BIRTH") ??
                s.centralPerson.names[0],
            );
            return (
              <li
                key={s.id}
                className="rounded-lg border p-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.title || central}</span>
                  <span style={{ color: "var(--muted)" }}>
                    · {s.mode.toLowerCase()} · {s.generations} gens · {s.viewCount} views
                    {s.passwordHash ? " · 🔒" : ""}
                    {s.includeLiving ? " · living shown" : ""}
                    {s.allowClaims ? " · claims on" : ""}
                    {s.revoked ? " · revoked" : ""}
                    {s.expiresAt && s.expiresAt.getTime() < Date.now() ? " · expired" : ""}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded bg-black/5 px-1.5 py-0.5 text-xs">{url}</code>
                  <CopyButton value={url} />
                  <a href={url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                    open
                  </a>
                  <form
                    action={toggleSharedViewClaims.bind(null, treeId, s.id)}
                  >
                    <input type="hidden" name="on" value={s.allowClaims ? "0" : "1"} />
                    <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                      {s.allowClaims ? "turn claims off" : "turn claims on"}
                    </button>
                  </form>
                  {!s.revoked && (
                    <form action={revokeSharedView.bind(null, treeId, s.id)}>
                      <button className="rounded-md border px-2 py-1 text-xs text-amber-600" style={{ borderColor: "var(--border)" }}>
                        revoke
                      </button>
                    </form>
                  )}
                  <form action={deleteSharedView.bind(null, treeId, s.id)}>
                    <button className="rounded-md border px-2 py-1 text-xs text-red-600" style={{ borderColor: "var(--border)" }}>
                      delete
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
          {shares.length === 0 && (
            <li className="text-sm" style={{ color: "var(--muted)" }}>
              No shared links yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
