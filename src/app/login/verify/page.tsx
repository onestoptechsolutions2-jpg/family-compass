export const metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <section className="glass-panel rounded-2xl border p-6 text-center sm:p-8" style={{ borderColor: "var(--glass-edge)" }}>
      <span className="mx-auto mb-4 grid size-10 place-items-center rounded-md border text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>FC</span>
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        A sign-in link is on its way. It expires in 24 hours.
      </p>
      </section>
    </main>
  );
}
