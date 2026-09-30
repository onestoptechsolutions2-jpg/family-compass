import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { unitPrice, type ProductOptions } from "@/lib/orders";
import type { DraftOptions } from "@/lib/order-shared";
import { randomToken } from "@/lib/slug";

/**
 * The cart is the customer's one open order: status DRAFT, owned by their user,
 * with no guest token. Anything typed before signing in lives in a guest draft
 * and is moved in here, so nothing is lost on the way through sign-in.
 */
export async function getCart(userId: string) {
  return db.order.findFirst({
    where: { userId, status: OrderStatus.DRAFT, guestToken: null },
    include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } },
  });
}

export async function getOrCreateCart(userId: string) {
  const existing = await getCart(userId);
  if (existing) return existing;
  await db.order.create({ data: { userId } });
  return (await getCart(userId))!;
}

export async function cartCount(userId: string): Promise<number> {
  const cart = await getCart(userId);
  return cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
}

/** Line prices as the customer sees them. Delivery is included, so the total is the sum. */
export function lineTotal(item: { quantity: number; options: unknown; product: { basePriceKes: number; options: unknown } }) {
  return unitPrice(item.product.basePriceKes, item.product.options as ProductOptions | null, (item.options ?? {}) as DraftOptions) * item.quantity;
}
export function cartTotal(items: Parameters<typeof lineTotal>[0][]) {
  return items.reduce((n, i) => n + lineTotal(i), 0);
}

/**
 * Move a guest draft's item into the customer's cart, carrying over any
 * delivery details typed on the draft. The emptied draft is kept, marked as
 * merged into that cart, so pressing the same link twice (double click, Back
 * button) finds the same cart instead of a dead end. Idempotent.
 */
export async function addGuestDraftToCart(userId: string, token: string): Promise<string | null> {
  const guest = await db.order.findUnique({ where: { guestToken: token }, include: { items: true } });
  if (!guest) return (await getCart(userId))?.id ?? null;
  if (guest.userId && guest.userId !== userId) return null;
  const merged = guest.notes?.match(/^merged:(.+)$/)?.[1];
  if (merged) return merged;
  if (guest.status !== OrderStatus.DRAFT) return guest.id;

  const cart = await getOrCreateCart(userId);
  // A draft made by "Edit" replaces the item it was copied from.
  const replaces = guest.notes?.match(/^replaces:(.+)$/)?.[1];
  await db.$transaction([
    db.orderItem.updateMany({ where: { orderId: guest.id }, data: { orderId: cart.id } }),
    ...(replaces ? [db.orderItem.deleteMany({ where: { id: replaces, orderId: cart.id } })] : []),
    db.order.update({
      where: { id: cart.id },
      data: {
        contactName: cart.contactName ?? guest.contactName,
        contactPhone: cart.contactPhone ?? guest.contactPhone,
        deliveryText: cart.deliveryText ?? guest.deliveryText,
      },
    }),
    db.order.update({ where: { id: guest.id }, data: { userId, status: OrderStatus.CANCELLED, notes: `merged:${cart.id}` } }),
  ]);
  return cart.id;
}

async function ownItem(userId: string, itemId: string) {
  const item = await db.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
  if (!item || item.order.userId !== userId || item.order.status !== OrderStatus.DRAFT) return null;
  return item;
}

export async function setQuantity(userId: string, itemId: string, quantity: number) {
  const item = await ownItem(userId, itemId);
  if (!item) return;
  const q = Math.min(Math.max(Math.floor(quantity) || 1, 1), 20);
  await db.orderItem.update({ where: { id: itemId }, data: { quantity: q } });
}

export async function removeItem(userId: string, itemId: string) {
  const item = await ownItem(userId, itemId);
  if (!item) return;
  await db.orderItem.delete({ where: { id: itemId } });
}

/** Add a personalised product to the customer's cart. */
export async function addItemToCart(userId: string, productSlug: string, options: DraftOptions, quantity = 1) {
  const product = await db.product.findFirst({ where: { slug: productSlug, active: true } });
  if (!product) return null;
  const cart = await getOrCreateCart(userId);
  const po = product.options as ProductOptions | null;
  return db.orderItem.create({
    data: {
      orderId: cart.id,
      productId: product.id,
      quantity: Math.min(Math.max(Math.floor(quantity) || 1, 1), 20),
      unitPriceKes: product.basePriceKes,
      options: { materialKey: po?.materials?.[0]?.key, sizeKey: po?.sizes?.[0]?.key, ...options } as object,
    },
  });
}

/**
 * Edit an item that is in the cart. The wizard works on drafts, so this makes a
 * private copy of the item as a draft and returns its token; when the customer
 * finishes and adds it to the cart, it replaces the original. The original stays
 * in the cart, untouched, until then. Only the owner of an unpaid cart can do this.
 */
export async function startEditItem(userId: string, itemId: string): Promise<string | null> {
  const item = await ownItem(userId, itemId);
  if (!item) return null;
  const { matches, ...options } = (item.options ?? {}) as DraftOptions; // answers about the old names no longer apply
  void matches;
  const token = randomToken(24);
  await db.order.create({
    data: {
      guestToken: token,
      userId,
      notes: `replaces:${itemId}`,
      items: { create: { productId: item.productId, quantity: item.quantity, unitPriceKes: item.unitPriceKes, options: options as object } },
    },
  });
  return token;
}
