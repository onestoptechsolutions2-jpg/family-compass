import { EngagementStatus } from "@prisma/client";

import { requirePlatformAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payments";
import { computeResearchQuote } from "@/lib/pricing";
import { quoteEngagement, deliverEngagement, setEngagementStatus } from "./actions";

export const metadata = { title: "Research engagements" };

export default async function AdminResearchPage() {
  await requirePlatformAdmin();
  const s = await getPaymentSettings();

  const items = await db.researchEngagement.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      subjectName: true,
      brief: true,
      community: true,
      region: true,
      generationsTarget: true,
      nodesTarget: true,
      status: true,
      quotedKes: true,
      quoteNote: true,
      deliverableUrl: true,
      createdAt: true,
      requestedBy: { select: { name: true, email: true, phone: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Research engagements</h1>
      {items.map((e) => {
        const est = computeResearchQuote(e.generationsTarget, e.nodesTarget, s);
        return (
          <div
            key={e.id}
            className="rounded-xl border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{e.subjectName}</span>
              <span style={{ color: "var(--muted)" }}>{e.status.toLowerCase().replace(/_/g, " ")}</span>
            </div>
            <div style={{ color: "var(--muted)" }}>
              {e.requestedBy.name ?? e.requestedBy.email}
              {e.requestedBy.phone ? ` · ${e.requestedBy.phone}` : ""} ·{" "}
              {e.generationsTarget ?? "?"} gens · {e.nodesTarget ?? "?"} nodes · est {s.currency}{" "}
              {est.toLocaleString()}
            </div>
            <p className="mt-1 whitespace-pre-wrap">{e.brief}</p>

            {["REQUESTED", "QUOTED"].includes(e.status) && (
              <form action={quoteEngagement.bind(null, e.id)} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  <span style={{ color: "var(--muted)" }}>Quote ({s.currency})</span>
                  <input
                    name="quotedKes"
                    type="number"
                    defaultValue={e.quotedKes ?? est}
                    className="ml-1 w-28 rounded-md border px-2 py-1"
                    style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                  />
                </label>
                <input
                  name="quoteNote"
                  placeholder="scope / timeline note"
                  className="w-56 rounded-md border px-2 py-1 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                />
                <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                  {e.status === "QUOTED" ? "Re-quote" : "Send quote"}
                </button>
              </form>
            )}

            {e.status === "ACTIVE" && (
              <form action={deliverEngagement.bind(null, e.id)} className="mt-3 flex flex-wrap items-end gap-2">
                <input
                  name="deliverableUrl"
                  placeholder="deliverable link (tree / PDF)"
                  className="w-64 rounded-md border px-2 py-1 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                />
                <input
                  name="deliveryNote"
                  placeholder="note"
                  className="w-40 rounded-md border px-2 py-1 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                />
                <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                  Mark delivered
                </button>
              </form>
            )}

            {["DELIVERED"].includes(e.status) && (
              <form action={setEngagementStatus.bind(null, e.id, EngagementStatus.CLOSED)} className="mt-2">
                <button className="text-xs text-brand-600 hover:underline">Close engagement</button>
              </form>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No engagements yet.
        </p>
      )}
    </div>
  );
}
