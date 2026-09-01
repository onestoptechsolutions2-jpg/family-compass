import Link from "next/link";
import { cookies } from "next/headers";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { sessionCookieName } from "@/lib/session";
import { NOTIFY_GROUPS, parsePrefs } from "@/lib/push";
import { PushSetup } from "@/components/PushSetup";
import {
  setMyPassword,
  removeMyPassword,
  toggleResearchConsent,
  revokeSession,
  revokeOtherSessions,
  setNotifyPrefs,
} from "./actions";

function ago(d: Date | null): string {
  if (!d) return "—";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)} d ago`;
  return d.toISOString().slice(0, 10);
}

export const metadata = { title: "Account" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function AccountPage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: {
      email: true,
      name: true,
      passwordHash: true,
      isPlatformAdmin: true,
      researchConsent: true,
      consentVersion: true,
      notifyPrefs: true,
    },
  });
  const hasPassword = Boolean(user.passwordHash);
  const prefs = parsePrefs(user.notifyPrefs);
  const style = { borderColor: "var(--border)", background: "var(--bg)" };

  const currentToken = (await cookies()).get(sessionCookieName())?.value ?? null;
  const sessions = await db.session.findMany({
    where: { userId: me.id, expires: { gt: new Date() } },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      sessionToken: true,
      device: true,
      ip: true,
      createdAt: true,
      lastSeenAt: true,
      standalone: true,
    },
  });
  const installCount = sessions.filter((s) => s.standalone).length;

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {user.name ? `${user.name} · ` : ""}
          {user.email}
          {user.isPlatformAdmin ? " · platform admin" : ""}
        </p>
      </div>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Lets you sign in with email + password instead of a one-time link.
        </p>
        <form action={setMyPassword} className="mt-3 flex flex-col gap-2">
          {hasPassword && (
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Current password</span>
              <input name="currentPassword" type="password" required className={field} style={style} />
            </label>
          )}
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>New password (10+ characters)</span>
            <input name="newPassword" type="password" required minLength={10} className={field} style={style} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Confirm</span>
            <input name="confirm" type="password" required className={field} style={style} />
          </label>
          <div>
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {hasPassword ? "Update password" : "Set password"}
            </button>
          </div>
        </form>
        {hasPassword && (
          <form action={removeMyPassword} className="mt-2">
            <button className="text-xs text-red-600 hover:underline">Remove password</button>
          </form>
        )}
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Research participation</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Allow your contributions to be used in aggregated, de-identified genealogy research.
          Living and private records are always excluded. See the{" "}
          <Link href="/policies/research" className="text-brand-600 hover:underline">
            Research &amp; Ethics policy
          </Link>
          .
        </p>
        <form action={toggleResearchConsent} className="mt-3">
          <input type="hidden" name="on" value={user.researchConsent ? "0" : "1"} />
          <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            {user.researchConsent ? "Currently ON — turn off" : "Currently OFF — turn on"}
          </button>
        </form>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Devices &amp; sign-ins</h2>
          {sessions.length > 1 && (
            <form action={revokeOtherSessions}>
              <button className="text-xs text-red-600 hover:underline">Sign out all others</button>
            </form>
          )}
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Where your account is currently signed in. If you don&apos;t recognise a device, sign it
          out and change your password.
          {installCount > 0 && (
            <>
              {" "}
              <span style={{ color: "var(--fg)" }}>
                Installed as an app on {installCount} device{installCount === 1 ? "" : "s"}.
              </span>
            </>
          )}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {sessions.map((s) => {
            const isCurrent = s.sessionToken === currentToken;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <div className="font-medium">
                    {s.device ?? "Unknown device"}
                    {isCurrent && (
                      <span
                        className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        this device
                      </span>
                    )}
                    {s.standalone && (
                      <span
                        className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                        title="Signed in from the installed app"
                      >
                        📲 installed
                      </span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {s.ip ? `${s.ip} · ` : ""}active {ago(s.lastSeenAt)} · since{" "}
                    {s.createdAt.toISOString().slice(0, 10)}
                  </div>
                </div>
                <form action={revokeSession.bind(null, s.id)}>
                  <button
                    className="rounded-md border px-2.5 py-1 text-xs"
                    style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                  >
                    {isCurrent ? "Sign out" : "Revoke"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="font-medium">Notifications</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          In-app notifications always appear in{" "}
          <Link href="/notifications" className="hover:underline" style={{ color: "var(--link)" }}>your inbox</Link>.
          Device notifications need turning on per device.
        </p>

        <div className="mt-3">
          <PushSetup />
        </div>

        <form action={setNotifyPrefs} className="mt-4 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="push" defaultChecked={prefs.push !== false} />
            <span>Send device notifications (when a device is set up above)</span>
          </label>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Don&apos;t notify me about:</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {NOTIFY_GROUPS.map((g) => (
              <label key={g.key} className="flex items-center gap-2">
                <input type="checkbox" name={`mute_${g.key}`} defaultChecked={prefs.muted.includes(g.key)} />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
          <button
            className="mt-2 self-start rounded-lg border px-3 py-1.5"
            style={{ borderColor: "var(--border)" }}
          >
            Save notification settings
          </button>
        </form>
      </section>
    </div>
  );
}
