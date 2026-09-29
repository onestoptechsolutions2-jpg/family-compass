import Link from "next/link";

export const metadata = { title: "Partner portal" };

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
        <Link href="/partner" className="font-semibold">🧭 Partner portal</Link>
        <Link href="/" className="text-sm" style={{ color: "var(--muted)" }}>Home</Link>
      </header>
      {children}
    </main>
  );
}
