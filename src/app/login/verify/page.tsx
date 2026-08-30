export const metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        A sign-in link is on its way. It expires in 24 hours.
      </p>
    </main>
  );
}
