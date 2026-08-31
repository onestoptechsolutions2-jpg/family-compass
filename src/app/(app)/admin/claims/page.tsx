import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { displayName } from "@/lib/person";
import { adminLinkByEmail, adminLinkByPhone, adminUnlink } from "./actions";

export const metadata = { title: "Claims" };
export const dynamic = "force-dynamic";

const NAME_SELECT = {
  first: true, surname: true, surnamePrefix: true, suffix: true, nick: true, title: true,
  preferred: true, type: true, order: true,
} as const;

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fs = { borderColor: "var(--border)", background: "var(--bg)" };

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; signin?: string }>;
}) {
  await requirePlatformAdmin();
  const { ok, err, signin } = await searchParams;

  const [claimed, pending] = await Promise.all([
    db.person.findMany({
      where: { claimedByUserId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        names: { select: NAME_SELECT },
        tree: { select: { id: true, name: true } },
        claimedBy: { select: { name: true, email: true, phone: true } },
      },
    }),
    db.personClaim.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, claimantName: true, phone: true, createdAt: true, tree: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Claims</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Link a person&apos;s profile straight to an account. Deceased profiles can&apos;t be
          claimed. The self-serve flow (invite link → request → tree manager approves) is preferred;
          use this for support and recovery.
        </p>
      </div>

      {ok && (
        <p className="rounded-lg border p-3 text-sm text-green-700" style={{ borderColor: "var(--border)" }}>
          {ok === "unlinked" ? "Profile unlinked." : "Profile linked."}
          {signin && (
            <>
              {" "}Sign-in link: <code className="break-all">{signin}</code>
            </>
          )}
        </p>
      )}
      {err && <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{decodeURIComponent(err)}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={adminLinkByEmail} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h2 className="font-medium">Link by account email</h2>
          <label className="mt-3 block text-sm">
            <span style={{ color: "var(--muted)" }}>Person ID</span>
            <input name="personId" required placeholder="cuid from the person page URL" className={field} style={fs} />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Account email</span>
            <input name="email" type="email" required className={field} style={fs} />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Role on the tree</span>
            <select name="role" defaultValue="CONTRIBUTOR" className={field} style={fs}>
              <option value="VIEWER">Viewer</option>
              <option value="CONTRIBUTOR">Contributor</option>
              <option value="EDITOR">Editor</option>
            </select>
          </label>
          <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Link</button>
        </form>

        <form action={adminLinkByPhone} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h2 className="font-medium">Link by WhatsApp number</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Creates the account if it doesn&apos;t exist and returns a one-time sign-in link.</p>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Person ID</span>
            <input name="personId" required className={field} style={fs} />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Phone</span>
            <input name="phone" required placeholder="+2547…" className={field} style={fs} />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Name (for a new account)</span>
            <input name="name" className={field} style={fs} />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Role on the tree</span>
            <select name="role" defaultValue="CONTRIBUTOR" className={field} style={fs}>
              <option value="VIEWER">Viewer</option>
              <option value="CONTRIBUTOR">Contributor</option>
              <option value="EDITOR">Editor</option>
            </select>
          </label>
          <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Link &amp; issue sign-in</button>
        </form>
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="font-medium">Pending claim requests</h2>
          <ul className="mt-2 flex flex-col text-sm">
            {pending.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b py-2 last:border-0" style={{ borderColor: "var(--border)" }}>
                <span>{c.claimantName} · {c.phone}</span>
                <Link href={`/trees/${c.tree.id}/claims`} className="text-brand-600 hover:underline">{c.tree.name} →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-medium">Recently claimed profiles</h2>
        <ul className="mt-2 flex flex-col text-sm">
          {claimed.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0" style={{ borderColor: "var(--border)" }}>
              <span>
                <Link href={`/trees/${p.tree.id}/people/${p.id}`} className="font-medium hover:underline">{displayName(p.names)}</Link>
                <span style={{ color: "var(--muted)" }}> · {p.tree.name} · {p.claimedBy?.name ?? p.claimedBy?.email ?? p.claimedBy?.phone ?? "—"}</span>
              </span>
              <form action={adminUnlink}>
                <input type="hidden" name="personId" value={p.id} />
                <button className="text-xs" style={{ color: "var(--danger)" }}>unlink</button>
              </form>
            </li>
          ))}
          {claimed.length === 0 && <li style={{ color: "var(--muted)" }}>No claimed profiles yet.</li>}
        </ul>
      </section>
    </div>
  );
}
