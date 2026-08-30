import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { getSessionUser } from "@/lib/rbac";
import { hasGoogleOAuth, env } from "@/lib/env";
import { passwordSignIn } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/app");
  const { callbackUrl = "/app", error } = await searchParams;
  const denied = error === "AccessDenied";
  const badLink = error === "BadLink";
  const badCreds = error === "BadCredentials";

  const field = "mt-1 w-full rounded-lg border px-4 py-2.5 text-sm";
  const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 text-lg font-semibold">
        🧭 Family Compass
      </Link>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {env.OPEN_SIGNUP
          ? "Your first sign-in creates your account."
          : "Access is invite-only. Open the sign-in link your family admin sends you on WhatsApp."}
      </p>

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

        <form action={passwordSignIn} className="flex flex-col gap-2">
          <div className="text-sm font-medium">Admin sign-in</div>
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
        </form>

        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <p className="font-medium" style={{ color: "var(--fg)" }}>
            Family member without a password?
          </p>
          <p className="mt-1">
            Open the tree&apos;s share link, find yourself, tap <strong>“This is me”</strong>, and
            confirm on WhatsApp. The admin then sends you a one-tap sign-in link.
          </p>
        </div>
      </div>
    </main>
  );
}
