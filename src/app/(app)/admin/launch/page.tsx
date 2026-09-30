import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/rbac";
import { evaluate, loadLaunchState } from "@/lib/launch-check";

export const metadata = { title: "Launch check" };
export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  await requirePlatformAdmin();
  const v = evaluate(await loadLaunchState());
  const todo = v.checks.filter((c) => !c.ok);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Launch check</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Ready for a test order by you", v.readyForTestOrder, "Sign in as admin, add a product to the cart and go through it as a customer would."],
          ["Ready for customers", v.readyForCustomers, "Everything a stranger needs to sign up, pay and receive."],
        ].map(([title, ok, note]) => (
          <div key={String(title)} className="rounded-xl border p-4" style={{ borderColor: ok ? "var(--success, #15803d)" : "var(--border)", background: "var(--card)" }}>
            <p className="text-sm font-medium">{title as string}</p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: ok ? "var(--success, #15803d)" : "var(--danger, #b45309)" }}>{ok ? "Yes" : "Not yet"}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{note as string}</p>
          </div>
        ))}
      </div>

      {todo.length > 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {todo.length} thing{todo.length === 1 ? "" : "s"} to do. The step-by-step for your first real order is in{" "}
          <code>docs/commerce/FIRST-ORDER.md</code>. Payments to verify are under <Link href="/admin/payments" className="underline">Payments</Link>.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {v.checks.map((c) => (
          <li key={c.id} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span aria-hidden>{c.ok ? "✅" : c.forCustomers ? "⛔" : "⚠️"}</span>
              <span className="font-medium">{c.label}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {c.forTestOrder ? "needed for a test order and customers" : c.forCustomers ? "needed for customers" : "recommended"}
              </span>
            </div>
            <p className="mt-1" style={{ color: "var(--muted)" }}>{c.detail}</p>
            {!c.ok && <p className="mt-1">How to fix: {c.fix}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
