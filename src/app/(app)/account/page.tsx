import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { setMyPassword, removeMyPassword } from "./actions";

export const metadata = { title: "Account" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireUser();
  const { ok, error } = await searchParams;
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { email: true, name: true, passwordHash: true, isPlatformAdmin: true },
  });
  const hasPassword = Boolean(user.passwordHash);
  const style = { borderColor: "var(--border)", background: "var(--bg)" };

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

      {ok && (
        <p className="rounded-lg border p-3 text-sm text-green-700" style={{ borderColor: "var(--border)" }}>
          {ok === "removed" ? "Password removed." : "Password saved."}
        </p>
      )}
      {error && (
        <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>
          {error === "current"
            ? "Current password is wrong."
            : error === "mismatch"
              ? "New passwords don't match."
              : error}
        </p>
      )}

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
    </div>
  );
}
