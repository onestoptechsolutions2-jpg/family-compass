import { GenerationKind, PaymentKind } from "@prisma/client";

import { loadTreeContext, canEdit, canManageTree } from "@/lib/rbac";
import { getChartsData } from "@/lib/queries/charts";
import { personOptions } from "@/lib/queries/people";
import { formatName } from "@/lib/person";
import {
  BUNDLES,
  KEEPER_PLAN,
  GENERATION_LABELS,
  GENERATION_NEEDS_CENTRAL,
} from "@/lib/pricing";
import { getPaymentSettings } from "@/lib/payments";
import { getProvider } from "@/lib/payments";
import { PersonSelect } from "@/components/PersonSelect";
import { MediaThumb } from "@/components/media/MediaThumb";
import {
  createGeneration,
  unlockGeneration,
  startCreditPurchase,
  startKeeperPurchase,
  submitMpesaCode,
  cancelPayment,
} from "./actions";

export const metadata = { title: "Charts & exports" };

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Queued…",
  RENDERING_PREVIEW: "Rendering preview…",
  PREVIEW_READY: "Preview ready",
  AWAITING_PAYMENT: "Needs a credit",
  PAID: "Unlocked — rendering…",
  RENDERING_OUTPUT: "Rendering download…",
  OUTPUT_READY: "Ready to download",
  FAILED: "Failed",
};

export default async function ChartsPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  const editable = canEdit(ctx.role);
  const canBuy = canManageTree(ctx.role);

  const [{ credits, keeperUntil, keeperActive, jobs, payments }, options, settings] =
    await Promise.all([
      getChartsData(treeId, ctx.workspace.id),
      personOptions(treeId),
      getPaymentSettings(),
    ]);
  const keeperPrice = settings.keeperPriceKes || KEEPER_PLAN.defaultPriceKes;

  const pending = payments.find((p) => p.status === "PENDING" || p.status === "AWAITING_VERIFICATION");
  const checkout = pending
    ? await getProvider(settings.provider).checkout({
        reference: pending.reference,
        amountKes: pending.amountKes,
        settings,
      })
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* plan / credits banner */}
      <div
        className="flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4"
        style={{
          borderColor: keeperActive ? "var(--color-brand-600)" : "var(--border)",
          background: "var(--card)",
        }}
      >
        <div>
          {keeperActive ? (
            <>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                Family plan
              </div>
              <div className="text-lg font-semibold text-brand-700">
                Active — unlimited downloads
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Renews / expires {keeperUntil?.toISOString().slice(0, 10)}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                Export credits
              </div>
              <div className="text-2xl font-semibold">{credits}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                First export free. After that the price depends on the document, how many
                generations and how many people/families it covers ({settings.currency}{" "}
                {settings.defaultPriceKes.toLocaleString()} for a standard one). Family plan =
                unlimited, any size.
              </div>
            </>
          )}
        </div>
        {canBuy && (
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
            <form action={startKeeperPurchase.bind(null, treeId)} className="contents">
              <button
                className="flex h-full min-w-44 flex-col rounded-lg border p-3 text-left text-sm transition-shadow hover:shadow-sm"
                style={{ borderColor: "var(--color-brand-600)", background: "var(--surface)" }}
              >
                <span className="font-medium">{keeperActive ? "Extend Family plan" : "Family plan"}</span>
                <span className="mt-0.5 text-base font-semibold">
                  {settings.currency} {keeperPrice.toLocaleString()}
                </span>
                <span className="mt-auto pt-1 text-xs" style={{ color: "var(--muted)" }}>
                  per year · unlimited downloads
                </span>
              </button>
            </form>
            {(Object.keys(BUNDLES) as (keyof typeof BUNDLES)[]).map((k) => {
              const price = k === "SINGLE" ? settings.defaultPriceKes : BUNDLES[k].priceKes;
              return (
                <form key={k} action={startCreditPurchase.bind(null, treeId)} className="contents">
                  <input type="hidden" name="kind" value={k} />
                  <button
                    className="flex h-full min-w-44 flex-col rounded-lg border p-3 text-left text-sm transition-shadow hover:shadow-sm"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <span className="font-medium">{BUNDLES[k].label}</span>
                    <span className="mt-0.5 text-base font-semibold">
                      {settings.currency} {price.toLocaleString()}
                    </span>
                    <span className="mt-auto pt-1 text-xs" style={{ color: "var(--muted)" }}>
                      {BUNDLES[k].blurb}
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>

      {/* active payment */}
      {pending && checkout && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}
        >
          <h3 className="font-medium">
            Complete your payment — {settings.currency} {pending.amountKes.toLocaleString()} for{" "}
            {pending.kind === "KEEPER"
              ? "the Family plan (1 year)"
              : `${pending.creditsGranted} credit${pending.creditsGranted === 1 ? "" : "s"}`}
          </h3>
          {checkout.mode === "manual" && (
            <>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Pay the exact amount, then submit your M-Pesa / transaction code below. Your{" "}
                {pending.kind === "KEEPER" ? "Family plan" : "download"} is released{" "}
                <strong>only after an admin confirms the payment</strong> — usually within a few hours.
              </p>
              <table className="mt-3 text-sm">
                <tbody>
                  {checkout.payTo?.map((row) => (
                    <tr key={row.label}>
                      <td className="pr-4" style={{ color: "var(--muted)" }}>
                        {row.label}
                      </td>
                      <td className="font-mono font-medium">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {checkout.note && (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  {checkout.note}
                </p>
              )}
              {pending.status === "AWAITING_VERIFICATION" ? (
                <p className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                  Code <strong>{pending.mpesaCode}</strong> submitted — we&apos;ll verify it shortly and
                  add your credits.
                  {pending.rejectionReason && (
                    <span className="text-red-600"> Rejected: {pending.rejectionReason}</span>
                  )}
                </p>
              ) : (
                <form
                  action={submitMpesaCode.bind(null, treeId, pending.id)}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>M-Pesa confirmation code</span>
                    <input
                      name="mpesaCode"
                      required
                      placeholder="e.g. SGH7X8K2ML"
                      className="mt-1 block rounded-lg border px-3 py-2 uppercase"
                      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                    />
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Phone (optional)</span>
                    <input
                      name="payerPhone"
                      placeholder="07…"
                      className="mt-1 block rounded-lg border px-3 py-2"
                      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                    />
                  </label>
                  <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    I&apos;ve paid
                  </button>
                </form>
              )}
            </>
          )}
          <form action={cancelPayment.bind(null, treeId, pending.id)} className="mt-2">
            <button className="text-xs text-red-600 hover:underline">cancel this payment</button>
          </form>
        </section>
      )}

      {/* new generation */}
      {editable && (
        <section>
          <h2 className="text-lg font-semibold">New chart or export</h2>
          <form
            action={createGeneration.bind(null, treeId)}
            className="mt-3 grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <label className="text-sm sm:col-span-2">
              <span style={{ color: "var(--muted)" }}>Type</span>
              <select
                name="kind"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                {Object.values(GenerationKind).map((k) => (
                  <option key={k} value={k}>
                    {GENERATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Central person (for charts)</span>
              <PersonSelect
                name="centralPersonId"
                options={options}
                defaultValue={ctx.tree.homePersonId}
              />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Generations</span>
              <input
                type="number"
                name="generations"
                min={2}
                max={6}
                defaultValue={4}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span style={{ color: "var(--muted)" }}>Title (optional)</span>
              <input
                name="title"
                placeholder={ctx.tree.name}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              />
            </label>
            <div className="sm:col-span-2">
              <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Generate free preview
              </button>
            </div>
          </form>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Charts need a central person. Family book, GEDCOM and .gramps exports use the whole tree.
          </p>
        </section>
      )}

      {/* generation list */}
      <section>
        <h2 className="text-lg font-semibold">Your charts &amp; exports</h2>
        <div className="mt-3 flex flex-col gap-3">
          {jobs.map((j) => {
            const central = j.centralPerson
              ? formatName(
                  j.centralPerson.names.find((n) => n.preferred) ??
                    j.centralPerson.names.find((n) => n.type === "BIRTH") ??
                    j.centralPerson.names[0],
                )
              : null;
            const canPreview = j.previewMediaId && ["PREVIEW_READY", "AWAITING_PAYMENT", "PAID", "RENDERING_OUTPUT", "OUTPUT_READY"].includes(j.status);
            return (
              <div
                key={j.id}
                className="flex flex-wrap items-start gap-4 rounded-xl border p-4"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                {canPreview && j.previewMediaId ? (
                  <a
                    href={`/api/media/${j.previewMediaId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-24 w-32 shrink-0 overflow-hidden rounded-lg border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <MediaThumb mediaId={j.previewMediaId} mimeType="image/png" alt="preview" />
                  </a>
                ) : (
                  <div
                    className="grid h-24 w-32 shrink-0 place-items-center rounded-lg border text-xs"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    {STATUS_LABEL[j.status] ?? j.status}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium">{GENERATION_LABELS[j.kind]}</div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    {central ? `Centered on ${central} · ` : ""}
                    {typeof (j.params as { generations?: number })?.generations === "number"
                      ? `${(j.params as { generations?: number }).generations} gens · `
                      : ""}
                    {j.nodeCount != null ? `${j.nodeCount} nodes · ` : ""}
                    {STATUS_LABEL[j.status] ?? j.status}
                    {j.freeUnlock ? " · free" : ""}
                  </div>
                  {["PREVIEW_READY", "AWAITING_PAYMENT"].includes(j.status) &&
                    !keeperActive &&
                    !j.freeUnlock && (
                      <div className="mt-0.5 text-sm">
                        This download:{" "}
                        <strong>
                          {settings.currency} {(j.priceKes || settings.defaultPriceKes).toLocaleString()}
                        </strong>{" "}
                        <span style={{ color: "var(--muted)" }}>
                          (≈ {Math.max(1, Math.ceil((j.priceKes || settings.defaultPriceKes) / settings.defaultPriceKes))}{" "}
                          credit
                          {Math.ceil((j.priceKes || settings.defaultPriceKes) / settings.defaultPriceKes) === 1
                            ? ""
                            : "s"}
                          )
                        </span>
                      </div>
                    )}
                  {j.error && <div className="mt-1 text-sm text-red-600">{j.error}</div>}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {j.status === "PREVIEW_READY" && editable && (
                      <form action={unlockGeneration.bind(null, treeId, j.id)}>
                        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                          {keeperActive
                            ? "Get clean download (Family plan)"
                            : "Unlock download"}
                        </button>
                      </form>
                    )}
                    {j.status === "AWAITING_PAYMENT" && (
                      <span className="text-sm text-amber-600">
                        Buy a credit above, then press unlock again.
                      </span>
                    )}
                    {j.status === "AWAITING_PAYMENT" && editable && (
                      <form action={unlockGeneration.bind(null, treeId, j.id)}>
                        <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                          Try unlock
                        </button>
                      </form>
                    )}
                    {j.status === "OUTPUT_READY" && j.outputMediaId && (
                      <a
                        href={`/api/generations/${j.id}/download`}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Nothing generated yet.
            </p>
          )}
        </div>
      </section>

      {/* payment history */}
      {payments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Payments</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{p.reference}</span>
                <span style={{ color: "var(--muted)" }}>
                  · {p.currency} {p.amountKes.toLocaleString()} ·{" "}
                  {p.kind === "KEEPER" ? "Family plan" : `${p.creditsGranted} credits`} ·{" "}
                  {p.status.toLowerCase().replace(/_/g, " ")}
                </span>
                {p.status === "REJECTED" && p.rejectionReason && (
                  <span className="text-red-600">— {p.rejectionReason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
