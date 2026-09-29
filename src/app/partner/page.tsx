import Link from "next/link";
import { JobStatus, PartnerStatus, QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getPartnerContext } from "@/lib/partner-auth";
import { JOB_STATUS_LABEL, skillLabel } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const card = "rounded-xl border p-4 text-sm";
const cardStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;

export default async function PartnerHome() {
  const { partner } = await getPartnerContext();

  if (!partner) {
    return (
      <div className={card} style={cardStyle}>
        <h1 className="text-lg font-semibold">Make products for families</h1>
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          Received an invite link? Open it while signed in with the Google account it was sent to.
          Otherwise, tell us what you make and we will review your application.
        </p>
        <Link href="/partner/apply" className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">Apply to become a partner</Link>
      </div>
    );
  }
  if (partner.status !== PartnerStatus.ACTIVE) {
    const msg: Record<string, string> = {
      APPLIED: "Your application is being reviewed. We will notify you when it is approved.",
      SUSPENDED: "Your account is paused. Contact us to sort it out.",
      REJECTED: "We could not approve this application.",
    };
    return <div className={card} style={cardStyle}>{msg[partner.status]}</div>;
  }

  const [toQuote, mine] = await Promise.all([
    db.productionJob.findMany({
      where: { status: JobStatus.QUOTING, quotes: { some: { partnerId: partner.id, status: { in: [QuoteStatus.REQUESTED, QuoteStatus.SUBMITTED] } } } },
      include: { quotes: { where: { partnerId: partner.id } }, orderItem: { include: { product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.productionJob.findMany({
      where: { partnerId: partner.id },
      include: { orderItem: { include: { product: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  const active = mine.filter((j) => j.status !== JobStatus.DELIVERED && j.status !== JobStatus.CANCELLED);
  const done = mine.filter((j) => j.status === JobStatus.DELIVERED);

  const Row = ({ j, note }: { j: (typeof mine)[number]; note?: string }) => (
    <Link href={`/partner/jobs/${j.id}`} className={`${card} block hover:shadow-sm`} style={cardStyle}>
      <div className="flex justify-between gap-3">
        <span className="font-medium">{j.orderItem.product.name}</span>
        <span style={{ color: "var(--muted)" }}>{note ?? JOB_STATUS_LABEL[j.status]}</span>
      </div>
      <div style={{ color: "var(--muted)" }}>
        {skillLabel(j.skill)}
        {j.dueAt ? ` · due ${j.dueAt.toISOString().slice(0, 10)}` : ""}
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">{partner.name}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Asked to quote ({toQuote.length})</h2>
        {toQuote.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>Nothing waiting. We will notify you.</p>}
        {toQuote.map((j) => (
          <Row key={j.id} j={j} note={j.quotes[0]?.status === QuoteStatus.SUBMITTED ? "Quote sent" : "Send your quote"} />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Your jobs ({active.length})</h2>
        {active.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>No active jobs.</p>}
        {active.map((j) => <Row key={j.id} j={j} />)}
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Delivered ({done.length})</h2>
          {done.map((j) => <Row key={j.id} j={j} note={j.paidOutAt ? "Paid" : "Payment due"} />)}
        </section>
      )}
    </div>
  );
}
