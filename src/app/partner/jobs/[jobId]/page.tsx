import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatus, QuoteStatus } from "@prisma/client";

import { requireActivePartner } from "@/lib/partner-auth";
import { JOB_STATUS_LABEL, jobForPartner, skillLabel } from "@/lib/jobs";
import { kes } from "@/lib/money";
import { getPaymentSettings } from "@/lib/payments";
import { proofAction, quoteAction, shipAction, startAction } from "../../actions";

export const dynamic = "force-dynamic";

const card = "rounded-xl border p-4 text-sm";
const cardStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;
const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;
const btn = "rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700";

export default async function PartnerJob({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { partner } = await requireActivePartner();
  const { jobId } = await params;
  const { error } = await searchParams;
  const job = await jobForPartner(partner.id, jobId);
  if (!job) notFound();

  const item = job.orderItem;
  const mine = job.partnerId === partner.id;
  const opts = (item.layoutSnapshot ?? item.options ?? {}) as { materialKey?: string; sizeKey?: string; name?: string; epitaph?: string };
  const material = (item.product.options as { materials?: { key: string; label: string }[] } | null)?.materials?.find((m) => m.key === opts.materialKey)?.label ?? opts.materialKey;
  const size = (item.product.options as { sizes?: { key: string; label: string }[] } | null)?.sizes?.find((m) => m.key === opts.sizeKey)?.label ?? opts.sizeKey;
  const myQuote = job.quotes[0];
  const shipsToCustomer = item.product.shipVia === "direct";
  const files = job.files;
  const receivingAddress = shipsToCustomer ? null : (await getPaymentSettings()).receivingAddress;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/partner" className="text-sm" style={{ color: "var(--muted)" }}>← Jobs</Link>
      <div>
        <h1 className="text-lg font-semibold">{item.product.name}</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {skillLabel(job.skill)} · {JOB_STATUS_LABEL[job.status]}
          {job.dueAt ? ` · due ${job.dueAt.toISOString().slice(0, 10)}` : ""}
        </p>
      </div>
      {error && <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>{error}</p>}

      <section className={card} style={cardStyle}>
        <h2 className="font-medium">What to make</h2>
        <ul className="mt-2 list-disc pl-5" style={{ color: "var(--muted)" }}>
          <li>Material: {material ?? "as shown on the sheet"}</li>
          <li>Size: {size ?? "as shown on the sheet"}</li>
          <li>Quantity: {item.quantity}</li>
        </ul>
        <p className="mt-3">
          Print sheet at real size:{" "}
          <a href={`/partner/jobs/${job.id}/print`} target="_blank" className="underline">SVG (vector)</a>
          {" · "}
          <a href={`/partner/jobs/${job.id}/print?format=png`} target="_blank" className="underline">PNG</a>
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          The QR code is part of the sheet. Do not resize or redraw it: the piece is checked by scanning it.
        </p>
      </section>

      {/* Quoting: only until someone is chosen */}
      {!job.partnerId && myQuote && job.status === JobStatus.QUOTING && (
        <form action={quoteAction.bind(null, job.id)} className={card} style={cardStyle}>
          <h2 className="font-medium">{myQuote.status === QuoteStatus.SUBMITTED ? "Your quote (you can change it)" : "Send your quote"}</h2>
          <label className="mt-2 block">Your price to make it (KES)
            <input name="costKes" type="number" min={1} required defaultValue={myQuote.costKes ?? ""} className={field} style={fieldStyle} />
          </label>
          <label className="mt-2 block">Days you need
            <input name="leadDays" type="number" min={1} required defaultValue={myQuote.leadDays ?? ""} className={field} style={fieldStyle} />
          </label>
          <label className="mt-2 block">Note (optional)
            <input name="note" defaultValue={myQuote.note ?? ""} maxLength={300} className={field} style={fieldStyle} />
          </label>
          <button className={`${btn} mt-3`}>{myQuote.status === QuoteStatus.SUBMITTED ? "Update quote" : "Send quote"}</button>
        </form>
      )}

      {mine && (
        <>
          <section className={card} style={cardStyle}>
            <h2 className="font-medium">Your terms</h2>
            <p className="mt-1">Agreed price {kes(job.agreedCostKes ?? 0)} · {job.leadDays} days</p>
            {job.paidOutAt && <p className="mt-1 text-green-700">Paid to you. Reference {job.payoutRef}.</p>}
            {job.status === JobStatus.DELIVERED && !job.paidOutAt && <p className="mt-1">Delivered. Your payment is due.</p>}
          </section>

          <section className={card} style={cardStyle}>
            <h2 className="font-medium">{shipsToCustomer ? "Ship to the customer" : "Ship to us"}</h2>
            {shipsToCustomer ? (
              <p className="mt-1" style={{ color: "var(--muted)" }}>
                {item.order.contactName} · {item.order.contactPhone}<br />
                {item.order.deliveryText}
              </p>
            ) : (
              <p className="mt-1" style={{ color: "var(--muted)" }}>
                This one comes to us for a check before it goes to the customer.
                {receivingAddress ? (
                  <span className="mt-1 block whitespace-pre-line font-medium" style={{ color: "var(--fg)" }}>{receivingAddress}</span>
                ) : (
                  " We will send you our address."
                )}
              </p>
            )}
          </section>

          {job.status === JobStatus.ASSIGNED && (
            <form action={startAction.bind(null, job.id)} className={card} style={cardStyle}>
              <h2 className="font-medium">Ready to begin?</h2>
              <button className={`${btn} mt-2`}>Start production</button>
            </form>
          )}

          {job.status === JobStatus.IN_PRODUCTION && (
            <form action={proofAction.bind(null, job.id)} className={card} style={cardStyle} encType="multipart/form-data">
              <h2 className="font-medium">Finished? Send a photo</h2>
              {job.rejectionNote && (
                <p className="mt-1 rounded-lg border p-2 text-red-600" style={{ borderColor: "var(--border)" }}>Not approved: {job.rejectionNote}</p>
              )}
              <p className="mt-1" style={{ color: "var(--muted)" }}>A clear photo of the finished piece with the QR code visible. We check it before you ship.</p>
              <input name="photo" type="file" accept="image/*" capture="environment" required className="mt-2 block w-full text-sm" />
              <button className={`${btn} mt-3`}>Send photo for approval</button>
            </form>
          )}

          {job.status === JobStatus.PROOF_SUBMITTED && (
            <section className={card} style={cardStyle}>
              <h2 className="font-medium">Photo sent</h2>
              <p className="mt-1" style={{ color: "var(--muted)" }}>Waiting for us to approve it. Please do not ship yet.</p>
            </section>
          )}

          {job.status === JobStatus.PROOF_APPROVED && (
            <form action={shipAction.bind(null, job.id)} className={card} style={cardStyle} encType="multipart/form-data">
              <h2 className="font-medium">Approved. Ship it</h2>
              <label className="mt-2 block">Courier and tracking number
                <input name="trackingNote" className={field} style={fieldStyle} placeholder="e.g. G4S waybill 12345" />
              </label>
              <label className="mt-2 block">Or a photo of the dispatch receipt
                <input name="receipt" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
              </label>
              <button className={`${btn} mt-3`}>I have shipped it</button>
            </form>
          )}

          {files.length > 0 && (
            <section className={card} style={cardStyle}>
              <h2 className="font-medium">Your uploads</h2>
              <ul className="mt-1 list-disc pl-5">
                {files.map((f) => (
                  <li key={f.id}>
                    <a href={`/api/job-files/${f.id}`} target="_blank" className="underline">
                      {f.kind === "finished_photo" ? "Finished piece" : "Dispatch proof"}
                    </a>{" "}
                    <span style={{ color: "var(--muted)" }}>{f.createdAt.toISOString().slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
