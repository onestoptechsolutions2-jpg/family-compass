import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";

const DAY = 864e5;

/** How long things are kept before the nightly sweep removes them. */
export const KEEP = {
  /** a design someone started and never signed in to keep */
  guestDraftDays: 30,
  /** a sign-in or confirm link that was never used (they expire much sooner; this is housekeeping) */
  loginTokenDays: 30,
} as const;

export type SweepResult = { guestDrafts: number; loginTokens: number; sessions: number };

/**
 * Nightly housekeeping, so the database does not fill with things nobody will ever open: visitors
 * build designs without an account, and every one leaves a row. Only ever removes what has no owner
 * and no money attached; a customer's cart or order is never touched.
 */
export async function sweepShop(now: Date = new Date()): Promise<SweepResult> {
  const drafts = await db.order.deleteMany({
    where: {
      status: OrderStatus.DRAFT,
      userId: null,
      payments: { none: {} },
      updatedAt: { lt: new Date(now.getTime() - KEEP.guestDraftDays * DAY) },
    },
  });
  const tokens = await db.loginToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - KEEP.loginTokenDays * DAY) } }, { usedAt: { lt: new Date(now.getTime() - KEEP.loginTokenDays * DAY) } }] },
  });
  const sessions = await db.session.deleteMany({ where: { expires: { lt: now } } });
  return { guestDrafts: drafts.count, loginTokens: tokens.count, sessions: sessions.count };
}
