import Link from "next/link";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/rbac";
import { createAccount } from "./actions";
import { safeNext } from "./safe-next";

export const metadata = { title: "Create your account" };

const MESSAGES: Record<string, string> = {
  closed: "New accounts are not open right now. Please try again soon.",
  slow: "Too many attempts. Please wait a while and try again.",
  name: "Please tell us your name.",
  email: "That email address does not look right.",
  password: "Use a password of at least 10 characters.",
  exists: "There is already an account with that email. Sign in instead.",
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext = "/shop", error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getSessionUser()) redirect(next);

  const field = "mt-1 w-full rounded-lg border px-4 py-2.5 text-sm";
  const style = { borderColor: "var(--border)", background: "var(--card)" };
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 text-lg font-semibold">🧭 Family Compass</Link>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        So we can keep your designs and orders together. It takes a minute.
      </p>
      {error && MESSAGES[error] && (
        <p role="alert" className="mt-4 rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{MESSAGES[error]}</p>
      )}
      {env.SHOP_SIGNUP && (
        <form action={createAccount} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="text-sm font-medium">Your name
            <input name="name" required autoComplete="name" maxLength={80} className={field} style={style} />
          </label>
          <label className="text-sm font-medium">Email
            <input name="email" type="email" required autoComplete="email" className={field} style={style} />
          </label>
          <label className="text-sm font-medium">Password
            <input name="password" type="password" required minLength={10} autoComplete="new-password" className={field} style={style} />
            <span className="mt-1 block text-xs font-normal" style={{ color: "var(--muted)" }}>At least 10 characters.</span>
          </label>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Create account</button>
        </form>
      )}
      <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
        Already have an account?{" "}
        <Link href={`/login?callbackUrl=${encodeURIComponent(next)}`} className="underline">Sign in</Link>
      </p>
    </main>
  );
}
