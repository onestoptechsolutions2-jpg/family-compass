import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";

export const metadata = { title: "Admin" };

export default async function AdminHomePage() {
  await requirePlatformAdmin();

  const [users, trees, pendingPayments, paidPayments] = await Promise.all([
    db.user.count(),
    db.tree.count(),
    db.payment.count({ where: { status: "AWAITING_VERIFICATION" } }),
    db.payment.count({ where: { status: "PAID" } }),
  ]);

  const revenue = await db.payment.aggregate({
    where: { status: "PAID" },
    _sum: { amountKes: true },
  });

  const cards = [
    { label: "Users", value: users },
    { label: "Trees", value: trees, href: "/admin/trees" },
    { label: "Payments awaiting verification", value: pendingPayments, href: "/admin/payments" },
    { label: "Paid generations", value: paidPayments },
    { label: "Revenue (KES)", value: revenue._sum.amountKes ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                {c.label}
              </div>
              <div className="mt-1 text-2xl font-semibold">{c.value}</div>
            </>
          );
          return c.href ? (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-xl border p-4 hover:shadow-sm"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={c.label}
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              {inner}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin/payments" className="text-brand-600 hover:underline">
          Payment verification →
        </Link>
        <Link href="/admin/research" className="text-brand-600 hover:underline">
          Research engagements →
        </Link>
        <Link href="/admin/settings" className="text-brand-600 hover:underline">
          Payment settings →
        </Link>
      </div>
    </div>
  );
}
