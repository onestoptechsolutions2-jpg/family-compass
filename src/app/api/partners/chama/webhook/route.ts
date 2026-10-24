import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { verifyChamaSignature } from "@/lib/chama-signature";
import { readTotals } from "@/lib/chama-partner-rules";
import { notifyTreeManagers } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Events from Chama about funeral funds it runs for us: fund.gift.paid, fund.gift.failed,
 * fund.closed. Each fund signs with its own secret (given to us once, when it was created), so the
 * fund is looked up first and nothing in the body is trusted until the signature over
 * "<timestamp>.<raw body>" checks out. A resent event (same eventId) is acknowledged and ignored.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let body: { eventId?: unknown; event?: unknown; data?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const data = body.data ?? {};
  const fundId = Number(data.fundId);
  const fund = Number.isInteger(fundId)
    ? await db.chamaFund.findUnique({
        where: { partnerFundId: fundId },
        select: { id: true, partnerSecret: true, memorial: { select: { treeId: true, personId: true } } },
      })
    : null;
  // the same answer for an unknown fund and a bad signature, so neither can be probed
  if (!fund?.partnerSecret || !verifyChamaSignature(raw, req.headers.get("x-chama-timestamp"), req.headers.get("x-chama-signature-256"), fund.partnerSecret)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const eventId = typeof body.eventId === "string" ? body.eventId.slice(0, 100) : "";
  const event = String(body.event ?? "");
  if (!eventId) return NextResponse.json({ error: "eventId missing" }, { status: 400 });

  const totals = readTotals(data);
  if (await db.partnerEvent.findUnique({ where: { eventId }, select: { eventId: true } })) return NextResponse.json({ ok: true, duplicate: true });
  try {
    await db.$transaction(async (tx) => {
      await tx.partnerEvent.create({ data: { eventId, source: "chama" } });
      if (event === "fund.gift.paid") {
        await tx.chamaFund.update({
          where: { id: fund.id },
          data: {
            ...(totals.total !== null ? { partnerTotalKes: totals.total } : {}),
            ...(totals.giftCount !== null ? { partnerGiftCount: totals.giftCount } : {}),
            partnerByBranch: totals.byBranch,
            partnerSyncedAt: new Date(),
          },
        });
      } else if (event === "fund.closed") {
        await tx.chamaFund.update({
          where: { id: fund.id },
          data: { partnerStatus: "closed", ...(totals.total !== null ? { partnerTotalKes: totals.total } : {}), partnerSyncedAt: new Date() },
        });
      }
    });
  } catch (e) {
    // two deliveries of the same event at the same moment: the second one loses here
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
    throw e;
  }

  const m = fund.memorial;
  if (m && event === "fund.gift.paid") {
    const amount = typeof data.amount === "number" ? data.amount : 0;
    const who = typeof data.name === "string" && data.name ? data.name.slice(0, 80) : "A well-wisher";
    await notifyTreeManagers(m.treeId, {
      kind: "fund.gift",
      title: `KES ${amount.toLocaleString("en-KE")} from ${who}`,
      body: totals.total !== null ? `The funeral fund now stands at KES ${totals.total.toLocaleString("en-KE")}.` : undefined,
      linkPath: `/trees/${m.treeId}/people/${m.personId}/memorial#fund`,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
