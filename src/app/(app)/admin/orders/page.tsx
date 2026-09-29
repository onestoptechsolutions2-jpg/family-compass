import { JobStatus, OrderStatus, PartnerStatus, QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { kes } from "@/lib/money";
import { publicOrigin } from "@/lib/origin";
import { requirePlatformAdmin } from "@/lib/rbac";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { JOB_STATUS_LABEL, skillLabel } from "@/lib/jobs";
import {
  acceptQuoteAction, approveProofAction, cancelOrder, deliveredAction, dispatchAction,
  openJobsAction, payoutAction, rejectProofAction, requestQuotesAction,
} from "./actions";

export const metadata = { title: "Production queue" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border px-3 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;
const btn = "rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700";
const ghost = "rounded-lg border px-3 py-1.5";
const ghostStyle = { borderColor: "var(--border)" } as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePlatformAdmin();
  const { error } = await searchParams;
  const origin = await publicOrigin();

  const [orders, partners] = await Promise.all([
    db.order.findMany({
      where: { status: { not: OrderStatus.DRAFT } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        payments: { select: { status: true, amountKes: true } },
        items: {
          include: {
            product: { select: { name: true, shipVia: true } },
            qrCode: { select: { code: true } },
            jobs: {
              orderBy: { stage: "asc" },
              include: {
                partner: { select: { name: true } },
                quotes: { include: { partner: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
                files: { select: { id: true, kind: true }, orderBy: { createdAt: "desc" } },
              },
            },
          },
        },
      },
    }),
    db.partner.findMany({ where: { status: PartnerStatus.ACTIVE }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Production queue</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Verify the payment first under Payments. Paid orders open jobs here: choose partners to quote, accept one,
        check their photo, then it ships.
      </p>
      {error && <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}
      {orders.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No orders yet.</p>}

      {orders.map((o) => {
        const jobs = o.items.flatMap((i) => i.jobs);
        const partnerCost = jobs.reduce((n, j) => n + (j.agreedCostKes ?? 0), 0);
        const hasCost = jobs.some((j) => j.agreedCostKes != null);
        const paid = o.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amountKes, 0);
        const isPaid = paid > 0 && o.status !== OrderStatus.AWAITING_DEPOSIT;
        const viaUs = o.items.some((i) => i.product.shipVia === "via_us");
        const allShipped = jobs.length > 0 && jobs.every((j) => j.status === JobStatus.SHIPPED || j.status === JobStatus.DELIVERED);

        return (
          <div key={o.id} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-xs">{o.id.slice(-8)}</span>
              <span className="font-medium">{ORDER_STATUS_LABEL[o.status]}</span>
              <span style={{ color: "var(--muted)" }}>{o.contactName ?? o.user?.name ?? o.user?.email} · {o.contactPhone ?? ""}</span>
            </div>
            <p className="mt-1" style={{ color: "var(--muted)" }}>Deliver to: {o.deliveryText ?? "—"}</p>
            <p className="mt-1">
              Customer paid {kes(paid)} of {kes(o.totalKes)}
              {hasCost && <> · partner cost {kes(partnerCost)} · margin {kes(paid - partnerCost)}</>}
            </p>

            {o.items.map((i) => {
              const snap = (i.layoutSnapshot ?? {}) as { name?: string; epitaph?: string };
              return (
                <div key={i.id} className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="font-medium">{i.product.name}: {snap.name ?? "—"}</div>
                  {i.qrCode && <div className="font-mono text-xs" style={{ color: "var(--muted)" }}>QR {origin}/q/{i.qrCode.code}</div>}
                  {i.qrCode && i.approvedAt && (
                    <div className="mt-1 flex gap-3 text-xs">
                      <a href={`/admin/orders/print/${i.id}`} target="_blank" className="underline">Print sheet (SVG)</a>
                      <a href={`/admin/orders/print/${i.id}?format=png`} target="_blank" className="underline">PNG</a>
                      <span style={{ color: "var(--muted)" }}>ships {i.product.shipVia === "direct" ? "direct to the customer" : "to us first"}</span>
                    </div>
                  )}

                  {i.jobs.length === 0 && isPaid && (
                    <form action={openJobsAction.bind(null, o.id)} className="mt-2">
                      <button className={btn}>Open production jobs</button>
                    </form>
                  )}

                  {i.jobs.map((j) => {
                    const photo = j.files.find((f) => f.kind === "finished_photo");
                    const receipt = j.files.find((f) => f.kind === "dispatch_proof");
                    const asked = new Set(j.quotes.map((q) => q.partnerId));
                    const eligible = partners.filter((p) => p.skills.includes(j.skill) && !asked.has(p.id));
                    return (
                      <div key={j.id} className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span className="font-medium">Stage {j.stage}: {skillLabel(j.skill)}</span>
                          <span>{JOB_STATUS_LABEL[j.status]}</span>
                          {j.partner && <span style={{ color: "var(--muted)" }}>{j.partner.name} · {kes(j.agreedCostKes ?? 0)} · {j.leadDays} days</span>}
                        </div>

                        {(j.status === JobStatus.OPEN || j.status === JobStatus.QUOTING) && (
                          <div className="mt-2 flex flex-col gap-2">
                            {j.quotes.length > 0 && (
                              <table className="w-full text-left text-xs">
                                <thead style={{ color: "var(--muted)" }}>
                                  <tr><th className="py-1">Partner</th><th>Status</th><th>Quote</th><th>Days</th><th>Margin</th><th /></tr>
                                </thead>
                                <tbody>
                                  {j.quotes.map((q) => (
                                    <tr key={q.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                                      <td className="py-1">{q.partner.name}</td>
                                      <td>{q.status.toLowerCase()}</td>
                                      <td>{q.costKes != null ? kes(q.costKes) : "—"}</td>
                                      <td>{q.leadDays ?? "—"}</td>
                                      <td className={q.costKes != null && o.totalKes - partnerCost - q.costKes < 0 ? "text-red-600" : ""}>
                                        {q.costKes != null ? kes(o.totalKes - partnerCost - q.costKes) : "—"}
                                      </td>
                                      <td>
                                        {q.status === QuoteStatus.SUBMITTED && (
                                          <form action={acceptQuoteAction.bind(null, q.id)}><button className={btn}>Accept</button></form>
                                        )}
                                        {q.note && <span className="ml-2" style={{ color: "var(--muted)" }}>{q.note}</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {eligible.length > 0 ? (
                              <form action={requestQuotesAction.bind(null, j.id)} className="flex flex-wrap items-center gap-3">
                                {eligible.map((p) => (
                                  <label key={p.id} className="flex items-center gap-1.5">
                                    <input type="checkbox" name="partnerIds" value={p.id} /> {p.name}
                                    {p.regions.length > 0 && <span className="text-xs" style={{ color: "var(--muted)" }}>({p.regions.join(", ")})</span>}
                                  </label>
                                ))}
                                <button className={btn}>Ask to quote</button>
                              </form>
                            ) : (
                              <p style={{ color: "var(--muted)" }}>
                                {j.quotes.length ? "Everyone with this speciality has been asked." : `No active partner does ${skillLabel(j.skill).toLowerCase()} yet. Add one under Partners.`}
                              </p>
                            )}
                          </div>
                        )}

                        {j.status === JobStatus.PROOF_SUBMITTED && (
                          <div className="mt-2">
                            {photo && (
                              <a href={`/api/job-files/${photo.id}`} target="_blank">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/job-files/${photo.id}`} alt="Finished piece" className="max-h-64 rounded-lg border" style={{ borderColor: "var(--border)" }} />
                              </a>
                            )}
                            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Check the names, spelling and that the QR scans, then approve.</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <form action={approveProofAction.bind(null, j.id)}><button className={btn}>Approve</button></form>
                              <form action={rejectProofAction.bind(null, j.id)} className="flex gap-2">
                                <input name="reason" required placeholder="What needs fixing" className={field} style={fieldStyle} />
                                <button className={ghost} style={ghostStyle}>Send back</button>
                              </form>
                            </div>
                          </div>
                        )}

                        {j.status === JobStatus.SHIPPED && (
                          <p className="mt-1" style={{ color: "var(--muted)" }}>
                            {j.trackingNote ?? "Dispatched"}
                            {receipt && <> · <a href={`/api/job-files/${receipt.id}`} target="_blank" className="underline">receipt</a></>}
                          </p>
                        )}

                        {j.status === JobStatus.DELIVERED && (
                          <div className="mt-1">
                            {j.paidOutAt ? (
                              <span style={{ color: "var(--muted)" }}>Partner paid · {j.payoutRef}</span>
                            ) : (
                              <form action={payoutAction.bind(null, j.id)} className="flex flex-wrap items-center gap-2">
                                <span>Pay {j.partner?.name} {kes(j.agreedCostKes ?? 0)}:</span>
                                <input name="reference" required placeholder="M-Pesa or bank reference" className={field} style={fieldStyle} />
                                <button className={btn}>Record payment</button>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {viaUs && allShipped && o.status !== OrderStatus.SHIPPED && o.status !== OrderStatus.DELIVERED && (
              <form action={dispatchAction.bind(null, o.id)} className="mt-3 flex flex-wrap items-center gap-2">
                <span>Received and checked? Send to the customer:</span>
                <input name="trackingNote" placeholder="Courier and tracking" className={field} style={fieldStyle} />
                <button className={btn}>Ship to customer</button>
              </form>
            )}
            {o.status === OrderStatus.SHIPPED && (
              <form action={deliveredAction.bind(null, o.id)} className="mt-3">
                <button className={btn}>Mark delivered</button>
              </form>
            )}
            {o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED && (
              <form action={cancelOrder.bind(null, o.id)} className="mt-2">
                <button className="text-xs underline" style={{ color: "var(--muted)" }}>Cancel order</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
