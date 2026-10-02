import { OrderStatus, PaymentStatus, Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

/** An address that can never receive mail, so an erased account cannot be signed in to or emailed. */
export const ERASED_DOMAIN = "deleted.invalid";
export const isErasedEmail = (email: string) => email.toLowerCase().endsWith(`@${ERASED_DOMAIN}`);

/** Orders a maker is working on or that are on their way: these must finish before an account can go. */
const IN_FLIGHT: OrderStatus[] = [
  OrderStatus.DEPOSIT_VERIFIED,
  OrderStatus.IN_DESIGN,
  OrderStatus.APPROVED,
  OrderStatus.SENT_TO_SUPPLIER,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.SHIPPED,
];

export type EraseCheck = { ok: true; trees: number; openOrders: number } | { ok: false; reason: string };

/** Whether this person's account can be erased now, and if not, why, in words they can act on. */
export async function canErase(userId: string): Promise<EraseCheck> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true, email: true } });
  if (!user) return { ok: false, reason: "We could not find that account." };
  if (isErasedEmail(user.email)) return { ok: false, reason: "This account has already been deleted." };
  if (user.isPlatformAdmin) return { ok: false, reason: "This is an administrator account. Ask another administrator to remove your access first." };

  const inFlight = await db.order.count({ where: { userId, status: { in: IN_FLIGHT } } });
  if (inFlight > 0) {
    return {
      ok: false,
      reason: `You have ${inFlight} paid ${inFlight === 1 ? "order" : "orders"} still being made or delivered. We cannot delete your account until ${inFlight === 1 ? "it arrives" : "they arrive"}. Message us if you need this sooner.`,
    };
  }
  const owned = await ownedWorkspaces(userId);
  const trees = owned.length ? await db.tree.count({ where: { workspaceId: { in: owned } } }) : 0;
  const open = await db.order.count({ where: { userId, status: { in: [OrderStatus.AWAITING_DEPOSIT, OrderStatus.DRAFT] } } });
  return { ok: true, trees, openOrders: open };
}

/** Workspaces where this person is the only owner: their family data goes with them. */
async function ownedWorkspaces(userId: string): Promise<string[]> {
  const mine = await db.membership.findMany({ where: { userId, role: Role.OWNER }, select: { workspaceId: true } });
  const sole: string[] = [];
  for (const m of mine) {
    const others = await db.membership.count({ where: { workspaceId: m.workspaceId, role: Role.OWNER, userId: { not: userId } } });
    if (others === 0) sole.push(m.workspaceId);
  }
  return sole;
}

/**
 * Erase a person: their family pages and everything in them, their name, email, phone and addresses,
 * their sign-ins. What stays is what the law and the books need: that an order existed, what it cost,
 * when it was paid and the payment's M-Pesa code, with nothing that says who it was.
 *
 * The account row itself is kept (payments point at it) but made unrecognisable and unusable.
 */
export async function eraseAccount(userId: string): Promise<{ trees: number }> {
  const check = await canErase(userId);
  if (!check.ok) throw new Error(check.reason);

  const sole = await ownedWorkspaces(userId);
  const trees = sole.length ? await db.tree.findMany({ where: { workspaceId: { in: sole } }, select: { id: true } }) : [];
  const treeIds = trees.map((t) => t.id);

  await db.$transaction(
    async (tx) => {
      // 1. Unpaid baskets and designs are not records worth keeping; unpaid orders are cancelled.
      await tx.order.deleteMany({ where: { userId, status: OrderStatus.DRAFT } });
      const unpaid = await tx.order.findMany({ where: { userId, status: OrderStatus.AWAITING_DEPOSIT }, select: { id: true } });
      if (unpaid.length) {
        const ids = unpaid.map((o) => o.id);
        await tx.payment.updateMany({
          where: { orderId: { in: ids }, status: { notIn: [PaymentStatus.PAID, PaymentStatus.CANCELLED] } },
          data: { status: PaymentStatus.CANCELLED },
        });
        await tx.order.updateMany({ where: { id: { in: ids } }, data: { status: OrderStatus.CANCELLED } });
      }

      // 2. What the orders say about a person goes; what they say about money stays.
      await tx.order.updateMany({ where: { userId }, data: { contactName: null, contactPhone: null, deliveryText: null, notes: null } });
      await tx.orderItem.updateMany({
        where: { order: { userId } },
        data: { options: Prisma.DbNull, layoutSnapshot: Prisma.DbNull, customerTracking: null, focusPersonId: null },
      });
      await tx.payment.updateMany({ where: { userId }, data: { payerPhone: null, rejectionReason: null } });

      // 3. Their family: every tree in a workspace they alone own, with its people, photos, memorials and QR codes.
      if (treeIds.length) await tx.tree.deleteMany({ where: { id: { in: treeIds } } });
      if (sole.length) {
        await tx.apiKey.deleteMany({ where: { workspaceId: { in: sole } } });
        await tx.webhookEndpoint.deleteMany({ where: { workspaceId: { in: sole } } });
        for (const id of sole) {
          await tx.workspace.update({ where: { id }, data: { name: "Deleted account", slug: `deleted-${id}` } });
        }
      }
      await tx.person.updateMany({ where: { claimedByUserId: userId }, data: { claimedByUserId: null } });
      await tx.membership.deleteMany({ where: { userId } });
      await tx.partnerMember.deleteMany({ where: { userId } });

      // 4. Ways back in.
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.loginToken.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.consentEvent.updateMany({ where: { userId }, data: { ip: null, userAgent: null, detail: null } });

      // 5. The account itself: kept so payments still have an owner, but nobody.
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `erased-${userId}@${ERASED_DOMAIN}`,
          name: "Deleted account",
          phone: null,
          image: null,
          passwordHash: null,
          emailVerified: null,
          personId: null,
          primaryTreeId: null,
          notifyPrefs: Prisma.DbNull,
          researchConsent: false,
          marketingConsent: false,
          isPlatformAdmin: false,
        },
      });
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  await writeAudit({ action: "account.erase", targetType: "user", targetId: userId, meta: { trees: treeIds.length } });
  return { trees: treeIds.length };
}
