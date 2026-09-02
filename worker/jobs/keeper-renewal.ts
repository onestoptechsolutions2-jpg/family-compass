import type { Job } from "pg-boss";
import { PaymentKind, PaymentStatus, Role } from "@prisma/client";

import { db } from "@/lib/db";
import type { JobPayloads } from "@/lib/queue";
import { QUEUE } from "@/lib/queue";
import { getPaymentSettings } from "@/lib/payments";
import { KEEPER_PLAN } from "@/lib/pricing";
import { paymentReference } from "@/lib/slug";
import { publicOrigin } from "@/lib/origin";
import { stkPush, darajaConfigured, DARAJA_PROVIDER_ID } from "@/lib/payments/daraja";
import { notifyTreeManagers } from "@/lib/notify";
import { logActivity } from "@/lib/activity";

type Payload = JobPayloads[typeof QUEUE.keeperRenewalScan];

/** Every Keeper tree gets one reminder this many days out, regardless of
 *  whether they've opted into proactive auto-charge. */
const REMINDER_LEAD_DAYS = 14;

/** Days-before-expiry on which an opted-in tree gets a proactive STK prompt.
 *  Three tries, spaced out, so a missed/declined prompt gets another shot
 *  before the plan actually lapses. */
const STK_LEAD_DAYS = [3, 2, 0];
const MAX_ATTEMPTS = STK_LEAD_DAYS.length;

const OPEN_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.AWAITING_STK,
  PaymentStatus.AWAITING_VERIFICATION,
];

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 864e5);
}

/** Tree.adminUserId if set, else the workspace's first OWNER — Payment.userId
 *  is required, and a proactively-initiated renewal has no signed-in actor. */
async function resolvePayer(workspaceId: string, adminUserId: string | null): Promise<string | null> {
  if (adminUserId) return adminUserId;
  const owner = await db.membership.findFirst({
    where: { workspaceId, role: Role.OWNER },
    select: { userId: true },
  });
  return owner?.userId ?? null;
}

/**
 * Runs daily. Two tiers, both scoped to Trees that have bought Keeper at
 * least once (keeperUntil is set):
 *  1. A reminder notification for everyone, once per keeperUntil cycle,
 *     REMINDER_LEAD_DAYS out.
 *  2. For Trees that explicitly opted into keeperAutoRenew, a proactive
 *     Daraja STK push on the days in STK_LEAD_DAYS — the customer still
 *     approves with their M-Pesa PIN, they just don't have to remember to
 *     visit the app first. See docs note in identity-layer memory / the
 *     Keeper auto-renewal spec discussed in chat.
 */
export async function handleKeeperRenewalScan(_jobs: Job<Payload>[]) {
  const settings = await getPaymentSettings();
  const stkAvailable = settings.provider === DARAJA_PROVIDER_ID && darajaConfigured;
  const horizon = new Date(Date.now() + REMINDER_LEAD_DAYS * 864e5);

  const trees = await db.tree.findMany({
    where: { keeperUntil: { not: null, lte: horizon } },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      adminUserId: true,
      keeperUntil: true,
      keeperAutoRenew: true,
      keeperRenewalPhone: true,
      keeperRenewalAttempts: true,
      keeperReminderSentAt: true,
    },
  });

  let reminded = 0;
  let charged = 0;

  for (const tree of trees) {
    if (!tree.keeperUntil) continue;
    const daysLeft = daysUntil(tree.keeperUntil);
    // More than a day past lapse — this cycle is over; a fresh manual
    // purchase (via fulfilPayment) starts the next one from scratch.
    if (daysLeft < -1) continue;

    if (!tree.keeperReminderSentAt) {
      await notifyTreeManagers(tree.id, {
        kind: "keeper.renewal_due",
        title: `${tree.name}'s family plan renews soon`,
        body: `Runs out ${tree.keeperUntil.toISOString().slice(0, 10)} — ${settings.currency} ${settings.keeperPriceKes.toLocaleString()} keeps unlimited downloads going for another year.`,
        linkPath: `/trees/${tree.id}/charts`,
      });
      await db.tree.update({ where: { id: tree.id }, data: { keeperReminderSentAt: new Date() } });
      reminded += 1;
    }

    if (
      !tree.keeperAutoRenew ||
      !tree.keeperRenewalPhone ||
      tree.keeperRenewalAttempts >= MAX_ATTEMPTS ||
      !STK_LEAD_DAYS.includes(daysLeft) ||
      !stkAvailable
    ) {
      continue;
    }

    const pending = await db.payment.findFirst({
      where: { treeId: tree.id, kind: PaymentKind.KEEPER, status: { in: OPEN_PAYMENT_STATUSES } },
      select: { id: true },
    });
    if (pending) continue; // a manual purchase or a previous auto attempt is already in flight

    const payerId = await resolvePayer(tree.workspaceId, tree.adminUserId);
    if (!payerId) continue; // no one to attribute the payment to — skip, reminder already covers this tree

    const amountKes = settings.keeperPriceKes || KEEPER_PLAN.defaultPriceKes;
    const reference = paymentReference();
    const payment = await db.payment.create({
      data: {
        workspaceId: tree.workspaceId,
        treeId: tree.id,
        userId: payerId,
        provider: settings.provider,
        kind: PaymentKind.KEEPER,
        creditsGranted: 0,
        amountKes,
        currency: settings.currency,
        reference,
        status: PaymentStatus.PENDING,
        payerNote: "auto-renewal",
      },
      select: { id: true },
    });

    try {
      const origin = await publicOrigin();
      const r = await stkPush({
        amountKes,
        phone: tree.keeperRenewalPhone,
        reference,
        description: "Family Compass Family plan (auto-renew)",
        callbackUrl: `${origin}/api/payments/webhook/${DARAJA_PROVIDER_ID}`,
      });
      await db.payment.update({
        where: { id: payment.id },
        data: {
          checkoutRequestId: r.checkoutRequestId,
          merchantRequestId: r.merchantRequestId,
          payerPhone: tree.keeperRenewalPhone,
          status: PaymentStatus.AWAITING_STK,
        },
      });
      await logActivity({
        treeId: tree.id,
        actorId: null,
        verb: "requested",
        objectType: "payment",
        objectId: payment.id,
        summary: `sent an M-Pesa prompt to auto-renew the family plan (attempt ${tree.keeperRenewalAttempts + 1}/${MAX_ATTEMPTS})`,
      });
      charged += 1;
    } catch (err) {
      // Daraja unreachable / rejected the request outright — don't leave a
      // dead PENDING payment blocking the next attempt.
      await db.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELLED, rejectionReason: String(err instanceof Error ? err.message : err) },
      });
      console.error(`[keeper-renewal] STK push failed for tree ${tree.id}`, err);
    }

    await db.tree.update({
      where: { id: tree.id },
      data: { keeperRenewalAttempts: { increment: 1 } },
    });
  }

  console.log(`[keeper-renewal] ${trees.length} due → ${reminded} reminded, ${charged} STK prompts sent`);
}
