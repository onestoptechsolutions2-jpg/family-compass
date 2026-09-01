import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/rbac";
import { getReceipt } from "@/lib/payments/receipt";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const user = await getSessionUser();
  const r = await getReceipt(reference);
  if (!r) notFound();

  const allowed =
    !!user && (user.id === r.userId || r.memberIds.includes(user.id) || user.isPlatformAdmin);
  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-sm" style={{ color: "var(--muted)" }}>
        This receipt is private. Sign in with the account that made the payment.
      </main>
    );
  }
  if (r.status !== "PAID") {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-sm" style={{ color: "var(--muted)" }}>
        No receipt yet — this payment is <strong>{r.status.toLowerCase().replace(/_/g, " ")}</strong>.
        A receipt is issued once it&apos;s confirmed.
      </main>
    );
  }

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1.5">
      <span style={{ color: "var(--muted)" }}>{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Receipt
            </p>
            <h1 className="mt-0.5 font-serif text-xl">{r.business}</h1>
          </div>
          <span className="text-sm" style={{ color: "var(--success)" }}>Paid ✓</span>
        </div>

        <div className="mt-5 border-t pt-3 text-sm" style={{ borderColor: "var(--hairline)" }}>
          <Row k="Reference" v={<code>{r.reference}</code>} />
          <Row k="Item" v={r.item} />
          {r.treeName && <Row k="Family tree" v={r.treeName} />}
          <Row k="Paid by" v={r.payer} />
          {r.payerPhone && <Row k="Phone" v={r.payerPhone} />}
          {r.mpesaCode && <Row k="M-Pesa code" v={<code>{r.mpesaCode}</code>} />}
          <Row k="Method" v={r.provider.replace(/_/g, " ")} />
          <Row k="Date" v={r.paidAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"} />
        </div>

        <div
          className="mt-3 flex items-baseline justify-between border-t pt-3"
          style={{ borderColor: "var(--hairline)" }}
        >
          <span className="text-sm" style={{ color: "var(--muted)" }}>Total</span>
          <span className="text-2xl font-semibold">
            {r.currency} {r.amountKes.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
        <PrintButton />
        <Link href="/app" className="hover:underline">Back to Family Compass</Link>
      </div>

      <style>{`@media print { .print-hide { display:none } body { background:#fff } }`}</style>
    </main>
  );
}
