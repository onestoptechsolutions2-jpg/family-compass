export const metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <section className="rounded-xl border p-6 text-center shadow-lg sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="mx-auto mb-4 grid size-10 place-items-center rounded-md border text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>FC</span>
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        A sign-in link is on its way. It expires in 24 hours.
      </p>
      </section>
    </main>
  );
}
