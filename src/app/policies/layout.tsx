import Link from "next/link";

import { POLICY_VERSION, POLICY_EFFECTIVE } from "@/lib/policy";

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          🧭 Family Compass
        </Link>
        <nav className="flex gap-3 text-sm" style={{ color: "var(--muted)" }}>
          <Link href="/policies/terms" className="hover:underline">
            Terms
          </Link>
          <Link href="/policies/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/policies/research" className="hover:underline">
            Research
          </Link>
        </nav>
      </header>
      <div className="mt-8 text-[15px] leading-relaxed">{children}</div>
      <footer className="mt-12 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        Version {POLICY_VERSION} · effective {POLICY_EFFECTIVE}. This is a plain-language summary,
        not legal advice.
      </footer>
    </main>
  );
}
