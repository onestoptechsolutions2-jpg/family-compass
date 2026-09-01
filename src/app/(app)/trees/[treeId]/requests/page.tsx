import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { treeRequests } from "@/lib/queries/requests";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function TreeRequestsPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role) && !ctx.isFamilyAdmin) notFound();

  const rows = await treeRequests(treeId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Requests</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Charts, books and exports people have asked for on this tree, and where each one is. A
          receipt link appears once a payment is confirmed.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Nothing requested yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="min-w-0">
                <div className="font-medium">{r.label}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  by {r.by} · {r.createdAt.toISOString().slice(0, 10)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: r.status === "OUTPUT_READY" ? "var(--accent-soft)" : "var(--surface-2)",
                    color: r.status === "OUTPUT_READY" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {r.statusLabel}
                </span>
                {r.receiptRef && (
                  <Link
                    href={`/receipts/${r.receiptRef}`}
                    className="text-xs hover:underline"
                    style={{ color: "var(--link)" }}
                  >
                    Receipt →
                  </Link>
                )}
                {r.href && (
                  <Link href={r.href} className="text-xs hover:underline" style={{ color: "var(--link)" }}>
                    Open →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
