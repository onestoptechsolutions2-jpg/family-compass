import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getPaymentSettings, getProvider } from "@/lib/payments";
import { submitPaymentCode, cancelPaymentById } from "./actions";

export const metadata = { title: "Complete payment" };

const KIND_LABEL: Record<string, string> = {
  SINGLE: "1 export credit",
  BUNDLE_5: "5 export credits",
  BUNDLE_15: "15 export credits",
  KEEPER: "Family plan (1 year)",
  DEEP_SEARCH: "Deep search",
  RESEARCH_PARTNER: "Research Partner engagement",
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const me = await requireUser();
  const payment = await db.payment.findFirst({
    where: { id: paymentId, userId: me.id },
    select: {
      id: true,
      kind: true,
      amountKes: true,
      currency: true,
      reference: true,
      status: true,
      mpesaCode: true,
      rejectionReason: true,
    },
  });
  if (!payment) notFound();

  const settings = await getPaymentSettings();
  const checkout = await getProvider(settings.provider).checkout({
    reference: payment.reference,
    amountKes: payment.amountKes,
    settings,
  });

  return (
    <main className="mx-auto max-w-md px-2 py-4">
      <Link href="/app" className="text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold">
        Pay {payment.currency} {payment.amountKes.toLocaleString()}
      </h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        For: {KIND_LABEL[payment.kind] ?? payment.kind}
      </p>

      {payment.status === "PAID" ? (
        <p className="mt-4 rounded-lg border p-3 text-sm text-green-700" style={{ borderColor: "var(--border)" }}>
          Paid — you&apos;re all set.
        </p>
      ) : (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}
        >
          {checkout.mode === "manual" && (
            <>
              <table className="text-sm">
                <tbody>
                  {checkout.payTo?.map((r) => (
                    <tr key={r.label}>
                      <td className="pr-4" style={{ color: "var(--muted)" }}>
                        {r.label}
                      </td>
                      <td className="font-mono font-medium">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {checkout.note && (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  {checkout.note}
                </p>
              )}
              {payment.status === "AWAITING_VERIFICATION" ? (
                <p className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                  Code <strong>{payment.mpesaCode}</strong> submitted — we&apos;ll verify shortly.
                  {payment.rejectionReason && (
                    <span className="text-red-600"> Rejected: {payment.rejectionReason}</span>
                  )}
                </p>
              ) : (
                <form
                  action={submitPaymentCode.bind(null, payment.id)}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>M-Pesa code</span>
                    <input
                      name="mpesaCode"
                      required
                      className="mt-1 block rounded-lg border px-3 py-2 uppercase"
                      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                    />
                  </label>
                  <label className="text-sm">
                    <span style={{ color: "var(--muted)" }}>Phone (optional)</span>
                    <input
                      name="payerPhone"
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
          <form action={cancelPaymentById.bind(null, payment.id)} className="mt-2">
            <button className="text-xs text-red-600 hover:underline">cancel</button>
          </form>
        </div>
      )}
    </main>
  );
}
