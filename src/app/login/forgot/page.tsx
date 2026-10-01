import Link from "next/link";

import { hasEmailProvider } from "@/lib/env";
import { sendResetLink } from "./actions";

export const metadata = { title: "Forgot your password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <section className="rounded-xl border p-6 shadow-lg sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <Link href="/" className="mb-7 inline-flex items-center gap-2.5 font-semibold">
        <span className="grid size-8 place-items-center rounded-md border text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>FC</span>
        <span>Family Compass</span>
      </Link>
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      {sent ? (
        <p className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
          If there is an account with that email, we have sent a sign-in link to it. It works once, for 24 hours.
        </p>
      ) : hasEmailProvider ? (
        <form action={sendResetLink} className="mt-6 flex flex-col gap-3">
          <label className="text-sm font-medium">Your email
            <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border px-4 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }} />
          </label>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Email me a sign-in link</button>
        </form>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          Message us on WhatsApp with the email you used and we will send you a new sign-in link.
        </p>
      )}
      <p className="mt-6 text-sm"><Link href="/login" className="underline">Back to sign in</Link></p>
      </section>
    </main>
  );
}
