import { requirePlatformAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { approvePayment, rejectPayment } from "./actions";

export const metadata = { title: "Payment verification" };

export default async function AdminPaymentsPage() {
  await requirePlatformAdmin();

  const payments = await db.payment.findMany({
    where: { status: { in: ["AWAITING_VERIFICATION", "PAID", "REJECTED", "PENDING"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      reference: true,
      kind: true,
      amountKes: true,
      currency: true,
      creditsGranted: true,
      mpesaCode: true,
      payerPhone: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      workspace: { select: { name: true } },
    },
  });

  const awaiting = payments.filter((p) => p.status === "AWAITING_VERIFICATION");
  const others = payments.filter((p) => p.status !== "AWAITING_VERIFICATION");

  const Row = ({ p, actionable }: { p: (typeof payments)[number]; actionable: boolean }) => (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="min-w-40">
        <div className="font-mono font-medium">{p.reference}</div>
        <div style={{ color: "var(--muted)" }}>
          {p.workspace.name} · {p.user.name ?? p.user.email}
        </div>
      </div>
      <div className="min-w-32">
        {p.currency} {p.amountKes.toLocaleString()} · {p.creditsGranted} credits
        <div style={{ color: "var(--muted)" }}>{p.kind}</div>
      </div>
      <div className="min-w-32">
        <div className="font-mono">{p.mpesaCode ?? "—"}</div>
        <div style={{ color: "var(--muted)" }}>{p.payerPhone ?? ""}</div>
      </div>
      <div className="min-w-24" style={{ color: "var(--muted)" }}>
        {p.status.toLowerCase().replace(/_/g, " ")}
        {p.rejectionReason ? ` — ${p.rejectionReason}` : ""}
      </div>
      {actionable && (
        <div className="ml-auto flex items-center gap-2">
          <form action={approvePayment.bind(null, p.id)}>
            <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
              Approve
            </button>
          </form>
          <form action={rejectPayment.bind(null, p.id)} className="flex items-center gap-1">
            <input
              name="reason"
              required
              placeholder="reason"
              className="w-32 rounded-md border px-2 py-1"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
            <button className="rounded-md border px-2 py-1 text-red-600" style={{ borderColor: "var(--border)" }}>
              Reject
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Payment verification</h1>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Awaiting verification ({awaiting.length})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {awaiting.map((p) => (
            <Row key={p.id} p={p} actionable />
          ))}
          {awaiting.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Nothing to verify right now.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Recent
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {others.map((p) => (
            <Row key={p.id} p={p} actionable={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
