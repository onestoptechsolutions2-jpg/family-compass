import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payments";
import { computeResearchQuote } from "@/lib/pricing";
import { requestEngagement, payEngagement } from "./actions";

export const metadata = { title: "Research Partner" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; n?: string }>;
}) {
  const me = await requireUser();
  const { g, n } = await searchParams;
  const style = { borderColor: "var(--border)", background: "var(--bg)" };
  const s = await getPaymentSettings();

  const est = computeResearchQuote(g ? Number(g) : 4, n ? Number(n) : 40, s);

  const mine = await db.researchEngagement.findMany({
    where: { requestedById: me.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      subjectName: true,
      status: true,
      quotedKes: true,
      quoteNote: true,
      deliverableUrl: true,
      deliveryNote: true,
      createdAt: true,
    },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Research Partner</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Hire us to research and build a family or clan tree on your behalf — field interviews,
          archives, cross-checking. Priced by depth: about {s.currency}{" "}
          {s.researchBaseKes.toLocaleString()} base + {s.currency}{" "}
          {s.researchPerGenerationKes.toLocaleString()}/generation + {s.currency}{" "}
          {s.researchPerNodeKes.toLocaleString()}/person or family. We send a firm quote first.
        </p>
      </div>

      <form
        action={requestEngagement}
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <label className="text-sm sm:col-span-2">
          <span style={{ color: "var(--muted)" }}>Who / what to research</span>
          <input name="subjectName" required placeholder="e.g. the Dindi lineage of Sakwa" className={field} style={style} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span style={{ color: "var(--muted)" }}>Brief — what you know, what you want</span>
          <textarea name="brief" required rows={4} className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Community</span>
          <input name="community" className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Region</span>
          <input name="region" className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Generations wanted</span>
          <input name="generationsTarget" type="number" defaultValue={g ?? 4} className={field} style={style} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>People/families wanted (approx)</span>
          <input name="nodesTarget" type="number" defaultValue={n ?? 40} className={field} style={style} />
        </label>
        <p className="text-xs sm:col-span-2" style={{ color: "var(--muted)" }}>
          Rough estimate at those targets: {s.currency} {est.toLocaleString()} (final quote may differ).
        </p>
        <div className="sm:col-span-2">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Request a quote
          </button>
        </div>
      </form>

      {mine.length > 0 && (
        <div>
          <h2 className="text-sm font-medium">Your requests</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {mine.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border p-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{e.subjectName}</span>
                  <span style={{ color: "var(--muted)" }}>{e.status.toLowerCase().replace(/_/g, " ")}</span>
                </div>
                {e.status === "QUOTED" && e.quotedKes && (
                  <div className="mt-1">
                    Quote: <strong>{s.currency} {e.quotedKes.toLocaleString()}</strong>
                    {e.quoteNote && <span style={{ color: "var(--muted)" }}> — {e.quoteNote}</span>}
                    <form action={payEngagement.bind(null, e.id)} className="mt-2">
                      <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                        Pay to start
                      </button>
                    </form>
                  </div>
                )}
                {e.status === "AWAITING_PAYMENT" && (
                  <div className="mt-1 text-amber-600">Payment pending — check your payment link.</div>
                )}
                {(e.status === "DELIVERED" || e.status === "CLOSED") && (
                  <div className="mt-1">
                    {e.deliverableUrl ? (
                      <Link href={e.deliverableUrl} className="text-brand-600 hover:underline">
                        Open deliverable
                      </Link>
                    ) : null}
                    {e.deliveryNote && <div style={{ color: "var(--muted)" }}>{e.deliveryNote}</div>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
