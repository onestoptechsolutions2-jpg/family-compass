import { FamilyType, OrderStatus, PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { slugify, randomToken, paymentReference } from "@/lib/slug";
import { addChildRef, createBarePerson, setVitalEvent, type Db } from "@/lib/person-write";
import { getPaymentSettings } from "@/lib/payments";
import { personalWorkspaceId } from "@/lib/workspace";
import { lines, splitName, type DraftOptions } from "@/lib/order-shared";
import { parseBirthdays } from "@/lib/print-layouts";

export { lines, splitName, type DraftOptions };

type Choice = { key: string; label: string; addKes: number };
export type ProductOptions = { materials?: Choice[]; sizes?: Choice[] };

/** Full payment up front: nothing is made until the whole price is paid (docs/commerce/DECISIONS.md). */
export const PAY_UP_FRONT_SHARE = 1;

export function unitPrice(basePriceKes: number, productOptions: ProductOptions | null, o: DraftOptions): number {
  const add = (list: Choice[] | undefined, key: string | undefined) =>
    list?.find((c) => c.key === key)?.addKes ?? 0;
  return basePriceKes + add(productOptions?.materials, o.materialKey) + add(productOptions?.sizes, o.sizeKey);
}

/** What the customer pays before production starts. */
export function amountDueNow(totalKes: number): number {
  return Math.ceil((totalKes * PAY_UP_FRONT_SHARE) / 100) * 100;
}

async function person(tx: Db, treeId: string, full: string, living = true) {
  const { first, surname } = splitName(full);
  return createBarePerson(treeId, { first, surname, living }, tx);
}

async function family(tx: Db, treeId: string, p1: string | null, p2: string | null, type: FamilyType = FamilyType.UNKNOWN) {
  return tx.family.create({
    data: { treeId, partner1Id: p1, partner2Id: p2, type },
    select: { id: true },
  });
}

type Tx = Db;
const normalise = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type Ctx = {
  treeId: string;
  userId: string;
  displayName: string;
  /** the customer's own Person; set by the first item that needs one, reused by the rest */
  customerId: string | null;
};
type ItemRow = {
  id: string;
  quantity: number;
  options: unknown;
  product: { pathway: "LIVING" | "REMEMBERED"; layout: string; basePriceKes: number; options: unknown };
};

/**
 * Make one cart item real: the person it is about, their relatives, a published
 * memorial or shared family view, the QR code, and the layout frozen for
 * printing. Returns what this item costs in total.
 */
async function buildItem(tx: Tx, ctx: Ctx, item: ItemRow): Promise<number> {
  const { treeId, userId, displayName } = ctx;
  const o = (item.options ?? {}) as DraftOptions;
  const isLiving = item.product.pathway === "LIVING";
  const layout = item.product.layout;
  // A wedding is about the couple, who may be ordered for by someone else, so it
  // has its own subject like a memorial does. Every other Living piece (tree,
  // banner, calendar, badges, shirt) is about the customer's own family.
  const subjectIsCustomer = isLiving && layout !== "wedding";

  // 1. The person the product is about. For the customer's own family that is
  // their own Person; otherwise it is someone the customer names (a person who
  // has died, or one of the couple), and the customer is added separately below.
  let subject: { id: string };
  if (subjectIsCustomer) {
    if (ctx.customerId) {
      subject = { id: ctx.customerId };
    } else {
      const nm = o.first ? { first: o.first, surname: o.surname ?? "" } : splitName(displayName);
      subject = await tx.person.create({
        data: {
          treeId,
          living: true,
          claimedByUserId: userId,
          publicDatePrecision: "YEAR",
          names: { create: { type: "BIRTH", preferred: true, order: 0, first: nm.first || null, surname: nm.surname || null } },
        },
        select: { id: true },
      });
      ctx.customerId = subject.id;
    }
    if (o.birth) await setVitalEvent(treeId, subject.id, "Birth", o.birth, "", tx);
  } else {
    subject = await createBarePerson(treeId, { first: o.first, surname: o.surname, living: isLiving }, tx);
    if (o.birth) await setVitalEvent(treeId, subject.id, "Birth", o.birth, "", tx);
    if (!isLiving && o.death) await setVitalEvent(treeId, subject.id, "Death", o.death, o.place ?? "", tx);
  }

  // A calendar's people with a full birth date become real people with a Birth event,
  // so the family record grows from it. Entries without a year (an anniversary, a
  // birthday with no year) stay on the calendar only.
  if (layout === "calendar") {
    const me = normalise([o.first, o.surname].filter(Boolean).join(" ") || displayName);
    for (const e of parseBirthdays(o.birthdays).entries) {
      if (!e.year) continue;
      const date = `${e.day} ${MONTH_NAMES[e.month]} ${e.year}`;
      if (normalise(e.name) === me) {
        await setVitalEvent(treeId, subject.id, "Birth", date, "", tx);
        continue;
      }
      const born = await person(tx, treeId, e.name);
      await setVitalEvent(treeId, born.id, "Birth", date, "", tx);
    }
  }

  // 2. Relatives.
  const parents = lines(o.parents);
  const siblings = lines(o.siblings);
  // Names already created, so a customer who lists themselves is not added twice.
  const byName = new Map<string, string>();
  const remember = (kind: string, name: string, id: string) => byName.set(`${kind}:${name.trim().toLowerCase()}`, id);
  let parentsFamily: string | null = null;
  if (parents.length || siblings.length) {
    const p1 = parents[0] ? (await person(tx, treeId, parents[0])).id : null;
    const p2 = parents[1] ? (await person(tx, treeId, parents[1])).id : null;
    // Each parent's own parents, so the family reaches one generation further up.
    for (const [child, names] of [[p1, lines(o.fatherParents)], [p2, lines(o.motherParents)]] as const) {
      if (!child || !names.length) continue;
      const g1 = (await person(tx, treeId, names[0]!)).id;
      const g2 = names[1] ? (await person(tx, treeId, names[1])).id : null;
      const gf = await family(tx, treeId, g1, g2, g2 ? FamilyType.MARRIED : FamilyType.UNKNOWN);
      await addChildRef(gf.id, child, undefined, tx);
    }
    parentsFamily = (await family(tx, treeId, p1, p2, p1 && p2 ? FamilyType.MARRIED : FamilyType.UNKNOWN)).id;
    await addChildRef(parentsFamily, subject.id, undefined, tx);
    for (const sib of siblings) {
      const sb = await person(tx, treeId, sib);
      remember("sibling", sib, sb.id);
      await addChildRef(parentsFamily, sb.id, undefined, tx);
    }
  }

  const spouses = lines(o.spouse);
  const kids = lines(o.children);
  let unionFamily: string | null = null;
  if (spouses.length || kids.length) {
    const sp = spouses[0] ? (await person(tx, treeId, spouses[0])).id : null;
    if (sp && spouses[0]) remember("spouse", spouses[0], sp);
    unionFamily = (await family(tx, treeId, subject.id, sp, sp ? FamilyType.MARRIED : FamilyType.UNKNOWN)).id;
    // The partner's own parents (a wedding tree): the second family the couple joins.
    if (sp && layout === "wedding") {
      const [sf, sm] = lines(o.spouseParents);
      if (sf || sm) {
        const f1 = sf ? (await person(tx, treeId, sf)).id : null;
        const f2 = sm ? (await person(tx, treeId, sm)).id : null;
        const pf = await family(tx, treeId, f1, f2, f1 && f2 ? FamilyType.MARRIED : FamilyType.UNKNOWN);
        await addChildRef(pf.id, sp, undefined, tx);
      }
    }
    for (const k of kids) {
      const kid = await person(tx, treeId, k);
      remember("child", k, kid.id);
      await addChildRef(unionFamily, kid.id, undefined, tx);
    }
  }

  // 3. The customer becomes a Person in this family, linked to their user.
  const listed = ctx.customerId ? undefined : byName.get(`${o.relation}:${displayName.trim().toLowerCase()}`);
  if (listed) {
    // The customer listed themselves among the relatives: that person is them.
    await tx.person.update({ where: { id: listed }, data: { claimedByUserId: userId } });
    ctx.customerId = listed;
  } else if (!ctx.customerId) {
    const { first, surname } = splitName(displayName);
    const me = await tx.person.create({
      data: {
        treeId,
        living: true,
        claimedByUserId: userId,
        names: { create: { type: "BIRTH", preferred: true, order: 0, first: first || null, surname: surname || null } },
      },
      select: { id: true },
    });
    ctx.customerId = me.id;
    if (o.relation === "child") {
      unionFamily ??= (await family(tx, treeId, subject.id, null)).id;
      await addChildRef(unionFamily, me.id, undefined, tx);
    } else if (o.relation === "sibling") {
      if (!parentsFamily) {
        parentsFamily = (await family(tx, treeId, null, null)).id;
        await addChildRef(parentsFamily, subject.id, undefined, tx);
      }
      await addChildRef(parentsFamily, me.id, undefined, tx);
    } else if (o.relation === "spouse" && !spouses.length) {
      await family(tx, treeId, subject.id, me.id, FamilyType.MARRIED);
    }
  }

  // 4. The page the QR opens: a published memorial, or a shared family view
  // (with claims on, so relatives can find themselves and join).
  const name = [o.first, o.surname].filter(Boolean).join(" ") || "Their";
  let memorialId: string | null = null;
  let sharedViewId: string | null = null;
  if (isLiving) {
    const view = await tx.sharedView.create({
      data: {
        treeId,
        createdById: userId,
        slug: `${slugify(name) || "family"}-${randomToken(6)}`,
        title: o.epitaph?.trim() || `${name} family`,
        centralPersonId: subject.id,
        includeLiving: true,
        allowClaims: true,
        generations: 3,
      },
      select: { id: true },
    });
    sharedViewId = view.id;
  } else {
    const memorial = await tx.memorial.create({
      data: {
        personId: subject.id,
        treeId,
        slug: `${slugify(name) || "memorial"}-${randomToken(6)}`,
        headline: `In loving memory of ${name}`,
        eulogy: o.epitaph?.trim() || null,
        bornText: o.birth?.trim() || null,
        diedText: [o.death?.trim(), o.place?.trim()].filter(Boolean).join(" · ") || null,
        published: true,
        groupContribToken: `grp_${randomToken(24)}`,
        createdById: userId,
      },
      select: { id: true },
    });
    memorialId = memorial.id;
  }
  await tx.qrCode.create({
    data: { code: randomToken(8), memorialId, sharedViewId, personId: subject.id, treeId, orderItemId: item.id },
  });

  // 5. Freeze the layout and price the line.
  const price = unitPrice(item.product.basePriceKes, item.product.options as ProductOptions | null, o);
  await tx.orderItem.update({
    where: { id: item.id },
    data: {
      focusPersonId: subject.id,
      unitPriceKes: price,
      approvedAt: new Date(),
      layoutSnapshot: { ...o, name, memorialId, sharedViewId, approvedAt: new Date().toISOString() },
    },
  });
  return price * item.quantity;
}

export type Delivery = { contactName: string; contactPhone: string; deliveryText: string };

/**
 * Check out a cart: every item becomes real family data and one payment is
 * opened for the whole basket, all in one transaction. Delivery is included in
 * the price. Safe to call twice: a cart that already moved on returns its payment.
 */
export async function checkoutCart(
  userId: string,
  orderId: string,
  delivery: Delivery,
): Promise<{ orderId: string; paymentId: string } | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.userId !== userId) return null;

  const existingPayment = () =>
    db.payment.findFirst({
      where: { orderId: order.id, kind: PaymentKind.ORDER_DEPOSIT },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  if (order.status !== OrderStatus.DRAFT) {
    const existing = await existingPayment();
    return existing ? { orderId: order.id, paymentId: existing.id } : null;
  }
  if (order.items.length === 0) return null;
  if (!delivery.contactName.trim() || !delivery.contactPhone.trim() || !delivery.deliveryText.trim()) return null;

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, personId: true, primaryTreeId: true },
  });
  const displayName = delivery.contactName.trim() || user.name || "My";

  // Resolved before the transaction: both are idempotent and use the shared client.
  const settings = await getPaymentSettings();
  const existingTreeId = user.primaryTreeId;
  const workspaceId = existingTreeId
    ? (await db.tree.findUniqueOrThrow({ where: { id: existingTreeId }, select: { workspaceId: true } })).workspaceId
    : await personalWorkspaceId(userId, displayName);

  // Everything below commits together or not at all.
  return db.$transaction(
    async (tx) => {
      // A double click or second tab must not build the family twice: whoever
      // flips DRAFT first wins, the other returns the payment that one opened.
      const won = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.DRAFT },
        data: { status: OrderStatus.AWAITING_DEPOSIT },
      });
      if (won.count === 0) {
        const dep = await tx.payment.findFirst({
          where: { orderId: order.id, kind: PaymentKind.ORDER_DEPOSIT },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        return dep ? { orderId: order.id, paymentId: dep.id } : null;
      }

      // The family container: the primary tree of this user, or a new one.
      let treeId = existingTreeId;
      if (!treeId) {
        const first = (order.items[0]!.options ?? {}) as DraftOptions;
        const label = first.surname?.trim() || splitName(displayName).surname || displayName;
        const tree = await tx.tree.create({
          data: {
            workspaceId,
            name: `${label} family`,
            slug: `${slugify(label) || "family"}-${randomToken(4)}`,
            adminUserId: userId,
          },
          select: { id: true },
        });
        treeId = tree.id;
      }

      const ctx: Ctx = { treeId, userId, displayName, customerId: user.personId };
      let total = 0;
      for (const item of order.items) total += await buildItem(tx, ctx, item as ItemRow);

      await tx.user.update({ where: { id: userId }, data: { personId: ctx.customerId, primaryTreeId: treeId } });
      await tx.tree.updateMany({ where: { id: treeId, homePersonId: null }, data: { homePersonId: ctx.customerId } });

      const due = amountDueNow(total);
      const payment = await tx.payment.create({
        data: {
          workspaceId,
          treeId,
          orderId: order.id,
          userId,
          provider: settings.provider,
          kind: PaymentKind.ORDER_DEPOSIT,
          amountKes: due,
          currency: settings.currency,
          reference: paymentReference(),
          status: PaymentStatus.PENDING,
        },
        select: { id: true },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          workspaceId,
          treeId,
          totalKes: total,
          depositKes: due,
          contactName: delivery.contactName.trim().slice(0, 120),
          contactPhone: delivery.contactPhone.trim().slice(0, 40),
          deliveryText: delivery.deliveryText.trim().slice(0, 500),
        },
      });
      return { orderId: order.id, paymentId: payment.id };
    },
    { timeout: 60_000 },
  );
}

/**
 * The single-item path used before the cart existed: a guest draft is signed
 * in, moved into the customer's cart, and checked out with the delivery
 * details the draft already holds.
 */
export async function fulfilDraft(
  userId: string,
  token: string,
): Promise<{ orderId: string; paymentId: string } | null> {
  const { addGuestDraftToCart } = await import("@/lib/cart");
  const guest = await db.order.findUnique({ where: { guestToken: token } });
  if (!guest) return null;
  const cartId = await addGuestDraftToCart(userId, token);
  if (!cartId) return null;
  const cart = await db.order.findUnique({ where: { id: cartId } });
  // A cart that was already checked out returns its payment before these are read.
  return checkoutCart(userId, cartId, {
    contactName: cart?.contactName ?? guest.contactName ?? "",
    contactPhone: cart?.contactPhone ?? guest.contactPhone ?? "",
    deliveryText: cart?.deliveryText ?? guest.deliveryText ?? "",
  });
}
