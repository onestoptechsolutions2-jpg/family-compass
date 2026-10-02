import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { getSessionUser } from "@/lib/rbac";
import { hasGoogleOAuth, hasFacebookOAuth, env } from "@/lib/env";
import { passwordSignIn } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; deleted?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/app");
  const { callbackUrl = "/app", error, deleted } = await searchParams;
  const denied = error === "AccessDenied";
  const badLink = error === "BadLink";
  const badCreds = error === "BadCredentials";

  const field = "mt-1 w-full rounded-lg border px-4 py-2.5 text-sm";
  const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
      <section className="glass-panel rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--glass-edge)" }}>
      <Link href="/" className="mb-7 inline-flex items-center gap-2.5 font-semibold">
        <span className="grid size-8 place-items-center rounded-md border text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>FC</span>
        <span>Family Compass</span>
      </Link>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {env.SHOP_SIGNUP || env.OPEN_SIGNUP
          ? "Sign in to see your designs and orders."
          : "Access is invite-only. Open the sign-in link your family admin sends you on WhatsApp."}
      </p>

      {deleted && (
        <p role="status" className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
          Your account has been deleted.
        </p>
      )}
      {denied && (
        <p className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>
          That address isn&apos;t approved. Ask an admin to invite you, then try again.
        </p>
      )}
      {badLink && (
        <p className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>
          That sign-in link is invalid or has expired. Ask the family admin to send a new one.
        </p>
      )}
      {badCreds && (
        <p className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>
          Invalid email or password.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {hasGoogleOAuth && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <button
              className="w-full rounded-lg border px-4 py-2.5 font-medium"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              Continue with Google
            </button>
          </form>
        )}

        {hasFacebookOAuth && (
          <form
            action={async () => {
              "use server";
              await signIn("facebook", { redirectTo: callbackUrl });
            }}
          >
            <button
              className="w-full rounded-lg border px-4 py-2.5 font-medium"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              Continue with Facebook
            </button>
          </form>
        )}

        <form action={passwordSignIn} className="flex flex-col gap-2">
          <div className="text-sm font-medium">Email and password</div>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input name="email" type="email" required placeholder="Email" className={field} style={fieldStyle} />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className={field}
            style={fieldStyle}
          />
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Sign in
          </button>
        
          <Link href="/login/forgot" className="text-center text-xs underline" style={{ color: "var(--muted)" }}>Forgot your password?</Link>
        </form>

        {env.SHOP_SIGNUP && (
          <div className="border-t pt-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            <p className="font-medium" style={{ color: "var(--fg)" }}>New here?</p>
            <p className="mt-1">
              <Link href={`/join?next=${encodeURIComponent(callbackUrl)}`} className="underline">Create an account</Link> to order and keep your designs.
            </p>
          </div>
        )}
      </div>
      </section>

        <div
          className="border-t px-1 pt-4 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <p className="font-medium" style={{ color: "var(--fg)" }}>
            First time — no password yet?
          </p>
          <p className="mt-1">
            Open the tree&apos;s share link, find yourself, tap <strong>“This is me”</strong>, and
            confirm on WhatsApp. The admin then sends you a one-tap sign-in link.
          </p>
        </div>

        <div
          className="border-t px-1 pt-4 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <p className="font-medium" style={{ color: "var(--fg)" }}>
            Already have a profile, but lost your link?
          </p>
          <p className="mt-1">
            That&apos;s fine — nothing is lost. Message your family&apos;s admin on WhatsApp and
            ask for a new sign-in link; they can send you one from the Claims page in one tap.
          </p>
        </div>
    </main>
  );
}
