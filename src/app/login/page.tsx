import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { getSessionUser } from "@/lib/rbac";
import { hasGoogleOAuth, hasEmailProvider } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/app");
  const { callbackUrl = "/app" } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-lg font-semibold">
        🧭 Family Compass
      </Link>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Building your family tree is free.
      </p>

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

        {hasEmailProvider && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("nodemailer", {
                email: String(formData.get("email") ?? ""),
                redirectTo: callbackUrl,
              });
            }}
            className="flex flex-col gap-2"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border px-4 py-2.5"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            />
            <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700">
              Email me a sign-in link
            </button>
          </form>
        )}

        {!hasGoogleOAuth && !hasEmailProvider && (
          <p className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)" }}>
            No sign-in method is configured. Set <code>GOOGLE_CLIENT_ID</code> /
            <code>GOOGLE_CLIENT_SECRET</code> or <code>EMAIL_SERVER</code> in the environment.
          </p>
        )}
      </div>
    </main>
  );
}
