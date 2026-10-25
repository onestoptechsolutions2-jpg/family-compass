import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { getPaymentSettings, getProvider } from "@/lib/payments";
import { orderRef, supportLink } from "@/lib/whatsapp";
import { submitPaymentCode, cancelPaymentById, startStkPush, pollStk } from "./actions";

export const metadata = { title: "Complete payment" };

const KIND_LABEL: Record<string, string> = {
  SINGLE: "1 export credit",
  BUNDLE_5: "5 export credits",
  BUNDLE_15: "15 export credits",
  KEEPER: "Family plan (1 year)",
  DEEP_SEARCH: "Deep search",
  RESEARCH_PARTNER: "Research Partner engagement",
  MEMORIAL_PASS: "Memorial Pass — unlimited book & programme prints",
  ORDER_DEPOSIT: "Payment for your order",
  ORDER_BALANCE: "Balance for your order",
};

const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;

export default async function PayPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const me = await requireUser();
  const meRow = await db.user.findUnique({ where: { id: me.id }, select: { phone: true } });
  const payment = await db.payment.findFirst({
    where: { id: paymentId, userId: me.id },
    select: {
      id: true,
      kind: true,
      orderId: true,
      amountKes: true,
      currency: true,
      reference: true,
      status: true,
      mpesaCode: true,
      payerPhone: true,
      rejectionReason: true,
      resultDesc: true,
    },
  });
  if (!payment) notFound();

  // For an order: what is being paid for, so the customer knows before they pay.
  const orderLines =
    payment.kind === "ORDER_DEPOSIT" && payment.orderId
      ? await db.orderItem.findMany({
          where: { orderId: payment.orderId },
          orderBy: { createdAt: "asc" },
          select: { id: true, quantity: true, unitPriceKes: true, layoutSnapshot: true, product: { select: { name: true } } },
        })
      : [];

  // For an order deposit: the memorial family can be invited to while the order is made.
  const memorial =
    payment.kind === "ORDER_DEPOSIT" && payment.orderId
      ? await db.memorial.findFirst({
          where: { qrCodes: { some: { orderItem: { orderId: payment.orderId } } } },
          select: { slug: true, groupContribToken: true, headline: true },
        })
      : null;
  const familyView =
    !memorial && payment.kind === "ORDER_DEPOSIT" && payment.orderId
      ? await db.sharedView.findFirst({
          where: { qrCodes: { some: { orderItem: { orderId: payment.orderId } } } },
          select: { slug: true, title: true },
        })
      : null;
  const inviteLink = memorial?.groupContribToken
    ? `${await publicOrigin()}/m/${memorial.slug}/contribute/${memorial.groupContribToken}`
    : familyView
      ? `${await publicOrigin()}/s/${familyView.slug}`
      : null;
  const inviteText = memorial
    ? `Please add your memories of ${memorial.headline ?? "our loved one"} here: ${inviteLink}`
    : `Find yourself on our family tree and add your side: ${inviteLink}`;

  const settings = await getPaymentSettings();
  const checkout = await getProvider(settings.provider).checkout({
    reference: payment.reference,
    amountKes: payment.amountKes,
    settings,
  });

  const codeForm = (
    <form action={submitPaymentCode.bind(null, payment.id)} className="mt-4 flex flex-col gap-3">
      <label className="text-sm">
        <span className="font-medium">Then paste the M-Pesa code from the confirmation SMS</span>
        <input name="mpesaCode" required autoCapitalize="characters" placeholder="e.g. SJK3ABCDEF" className="mt-1 block w-full rounded-lg border px-4 py-3 font-mono text-base uppercase" style={fieldStyle} />
      </label>
      <button className="w-full rounded-lg bg-brand-600 px-4 py-3.5 text-base font-medium text-white hover:bg-brand-700">
        I&apos;ve paid
      </button>
    </form>
  );
  // One way to pay up front (the paybill, else the till); anything else is a tap away.
  const rows = (checkout.mode === "stk" ? [] : checkout.payTo) ?? [];
  const hasPaybill = rows.some((r) => /paybill/i.test(r.label));
  const primary = rows.filter((r) => !/^bank/i.test(r.label) && !(hasPaybill && /till/i.test(r.label)));
  const others = rows.filter((r) => !primary.includes(r));

  const invite = inviteLink && (
    <div className="mt-6 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-medium">While you wait: invite the family</p>
      <p className="mt-1" style={{ color: "var(--muted)" }}>
        {memorial
          ? "Ask relatives to add their memories to the memorial. Every memory they add stays with the family."
          : "Ask relatives to open the family page, find themselves and add their side of the tree."}
      </p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        Share on WhatsApp
      </a>
    </div>
  );

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
      {orderLines.length > 0 && (
        <ul className="mt-3 divide-y rounded-xl border text-sm" style={{ borderColor: "var(--border)" }}>
          {orderLines.map((l) => {
            const who = ((l.layoutSnapshot ?? {}) as { name?: string; title?: string }).title ?? ((l.layoutSnapshot ?? {}) as { name?: string }).name;
            return (
              <li key={l.id} className="flex items-baseline justify-between gap-3 px-3 py-2" style={{ borderColor: "var(--border)" }}>
                <span>
                  {l.product.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""}
                  {who ? <span style={{ color: "var(--muted)" }}> · {who}</span> : null}
                </span>
                <span>{payment.currency} {(l.unitPriceKes * l.quantity).toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      )}

      {payment.status === "PAID" ? (
        <p className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--success)" }}>
          Paid — you&apos;re all set.
        </p>
      ) : (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}
        >
          {checkout.mode === "stk" ? (
            <>
              {payment.status === "AWAITING_STK" ? (
                <>
                  <p className="text-sm font-medium">Check your phone 📲</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    We sent an M-Pesa request{payment.payerPhone ? ` to ${payment.payerPhone}` : ""}.
                    Enter your PIN to approve it, then tap refresh.
                  </p>
                  <form action={pollStk.bind(null, payment.id)} className="mt-3">
                    <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                      I&apos;ve approved it — check
                    </button>
                  </form>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer" style={{ color: "var(--muted)" }}>
                      Prompt didn&apos;t arrive? Pay to the Till and paste the code
                    </summary>
                    {codeForm}
                  </details>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{checkout.note}</p>
                  {payment.status === "REJECTED" && (payment.rejectionReason || payment.resultDesc) && (
                    <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
                      {payment.rejectionReason ?? payment.resultDesc}. Try again.
                    </p>
                  )}
                  <form action={startStkPush.bind(null, payment.id)} className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      <span style={{ color: "var(--muted)" }}>Safaricom number</span>
                      <input
                        name="phone"
                        required
                        inputMode="tel"
                        defaultValue={payment.payerPhone ?? meRow?.phone ?? ""}
                        placeholder="07XX XXX XXX"
                        className="mt-1 block rounded-lg border px-3 py-2"
                        style={fieldStyle}
                      />
                    </label>
                    <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                      Send M-Pesa prompt
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Send by M-Pesa</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {primary.map((r) => (
                  <div key={r.label} className="contents">
                    <dt style={{ color: "var(--muted)" }}>{r.label}</dt>
                    <dd className="font-mono text-base font-semibold">{r.value}</dd>
                  </div>
                ))}
              </dl>
              {(others.length > 0 || checkout.note) && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer" style={{ color: "var(--muted)" }}>Other ways to pay</summary>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    {others.map((r) => (
                      <div key={r.label} className="contents">
                        <dt style={{ color: "var(--muted)" }}>{r.label}</dt>
                        <dd className="font-mono">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {checkout.note && <p className="mt-2" style={{ color: "var(--muted)" }}>{checkout.note}</p>}
                </details>
              )}
              {payment.status === "AWAITING_VERIFICATION" ? (
                <p className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                  Code <strong>{payment.mpesaCode}</strong> submitted — we&apos;ll verify shortly.
                  {payment.rejectionReason && (
                    <span style={{ color: "var(--danger)" }}> Rejected: {payment.rejectionReason}</span>
                  )}
                </p>
              ) : (
                codeForm
              )}
            </>
          )}

          <a
            href={supportLink(`Hello, I need help paying for my order${payment.orderId ? ` ${orderRef(payment.orderId)}` : ""} (reference ${payment.reference}).`)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-center text-sm underline"
            style={{ color: "#008069" }}
          >
            Need help? Chat with us on WhatsApp
          </a>
          <form action={cancelPaymentById.bind(null, payment.id)} className="mt-2">
            <button className="text-xs" style={{ color: "var(--danger)" }}>cancel</button>
          </form>
        </div>
      )}
      {invite}
    </main>
  );
}
