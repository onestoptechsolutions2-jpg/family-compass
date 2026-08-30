import Link from "next/link";

export const metadata = { title: "Sign-in problem" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">We couldn&apos;t sign you in</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {error ? `Reason: ${error}` : "The sign-in link may have expired or already been used."}
      </p>
      <Link href="/login" className="mt-6 font-medium text-brand-600 hover:underline">
        Try again
      </Link>
    </main>
  );
}
