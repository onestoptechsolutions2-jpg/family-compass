import { FamilyType, OrderStatus, PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { slugify, randomToken, paymentReference } from "@/lib/slug";
import { addChildRef, createBarePerson, setVitalEvent } from "@/lib/person-write";
import { getPaymentSettings } from "@/lib/payments";
import { personalWorkspaceId } from "@/lib/workspace";

/** What the wizard collects, kept on OrderItem.options until the account step. */
export type DraftOptions = {
  first?: string;
  surname?: string;
  birth?: string;
  death?: string;
  place?: string;
  epitaph?: string;
  parents?: string;
  spouse?: string;
  children?: string;
  siblings?: string;
  materialKey?: string;
  sizeKey?: string;
  relation?: "child" | "spouse" | "sibling" | "other";
};

type Choice = { key: string; label: string; addKes: number };
export type ProductOptions = { materials?: Choice[]; sizes?: Choice[] };

export const DEPOSIT_SHARE = 0.5; // take at least half upfront (docs/commerce/PLAN.md)

export function unitPrice(basePriceKes: number, productOptions: ProductOptions | null, o: DraftOptions): number {
  const add = (list: Choice[] | undefined, key: string | undefined) =>
    list?.find((c) => c.key === key)?.addKes ?? 0;
  return basePriceKes + add(productOptions?.materials, o.materialKey) + add(productOptions?.sizes, o.sizeKey);
}

export function depositFor(totalKes: number): number {
  return Math.ceil((totalKes * DEPOSIT_SHARE) / 100) * 100;
}

/** One name per line; blank lines dropped. */
export function lines(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function splitName(full: string): { first: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] ?? "", surname: "" };
  return { first: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] ?? "" };
}

async function person(treeId: string, full: string, living = true) {
  const { first, surname } = splitName(full);
  return createBarePerson(treeId, { first, surname, living });
}

async function family(treeId: string, p1: string | null, p2: string | null, type: FamilyType = FamilyType.UNKNOWN) {
  return db.family.create({
    data: { treeId, partner1Id: p1, partner2Id: p2, type },
    select: { id: true },
  });
}

/**
 * Turn a guest draft into real family data: the customer's own Person and
 * primary Tree, the person the product is about, their relatives, a published
 * memorial, the QR code, the frozen layout and a deposit payment.
 * Safe to call twice: a draft that already moved on returns its deposit.
 */
export async function fulfilDraft(
  userId: string,
  token: string,
): Promise<{ orderId: string; paymentId: string } | null> {
  const order = await db.order.findUnique({
    where: { guestToken: token },
    include: { items: { include: { product: true }, take: 1 } },
  });
  const item = order?.items[0];
  if (!order || !item) return null;
  if (order.userId && order.userId !== userId) return null;

  if (order.status !== OrderStatus.DRAFT) {
    const existing = await db.payment.findFirst({
      where: { orderId: order.id, kind: PaymentKind.ORDER_DEPOSIT },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return existing ? { orderId: order.id, paymentId: existing.id } : null;
  }

  const o = (item.options ?? {}) as DraftOptions;
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, personId: true, primaryTreeId: true },
  });
  const displayName = order.contactName || user.name || "My";

  // 1. Family container: the primary tree of this user, or a new one.
  let treeId = user.primaryTreeId;
  let workspaceId: string;
  if (treeId) {
    workspaceId = (await db.tree.findUniqueOrThrow({ where: { id: treeId }, select: { workspaceId: true } })).workspaceId;
  } else {
    workspaceId = await personalWorkspaceId(userId, displayName);
    const label = o.surname?.trim() || splitName(displayName).surname || displayName;
    const base = slugify(label) || "family";
    const tree = await db.tree.create({
      data: {
        workspaceId,
        name: `${label} family`,
        slug: `${base}-${randomToken(4)}`,
        adminUserId: userId,
      },
      select: { id: true },
    });
    treeId = tree.id;
  }

  // 2. The person the product is about.
  const subject = await createBarePerson(treeId, { first: o.first, surname: o.surname, living: false });
  if (o.birth) await setVitalEvent(treeId, subject.id, "Birth", o.birth, "");
  if (o.death) await setVitalEvent(treeId, subject.id, "Death", o.death, o.place ?? "");

  // 3. Relatives.
  const parents = lines(o.parents);
  const siblings = lines(o.siblings);
  let parentsFamily: string | null = null;
  if (parents.length || siblings.length) {
    const p1 = parents[0] ? (await person(treeId, parents[0])).id : null;
    const p2 = parents[1] ? (await person(treeId, parents[1])).id : null;
    parentsFamily = (await family(treeId, p1, p2, p1 && p2 ? FamilyType.MARRIED : FamilyType.UNKNOWN)).id;
    await addChildRef(parentsFamily, subject.id);
    for (const s of siblings) await addChildRef(parentsFamily, (await person(treeId, s)).id);
  }

  const spouses = lines(o.spouse);
  const kids = lines(o.children);
  let unionFamily: string | null = null;
  if (spouses.length || kids.length) {
    const sp = spouses[0] ? (await person(treeId, spouses[0])).id : null;
    unionFamily = (await family(treeId, subject.id, sp, sp ? FamilyType.MARRIED : FamilyType.UNKNOWN)).id;
    for (const k of kids) await addChildRef(unionFamily, (await person(treeId, k)).id);
  }

  // 4. The customer becomes a Person in this family, linked to their user.
  let customerId = user.personId;
  if (!customerId) {
    const { first, surname } = splitName(displayName);
    const me = await db.person.create({
      data: {
        treeId,
        living: true,
        claimedByUserId: userId,
        names: { create: { type: "BIRTH", preferred: true, order: 0, first: first || null, surname: surname || null } },
      },
      select: { id: true },
    });
    customerId = me.id;
    if (o.relation === "child") {
      unionFamily ??= (await family(treeId, subject.id, null)).id;
      await addChildRef(unionFamily, me.id);
    } else if (o.relation === "sibling") {
      if (!parentsFamily) {
        parentsFamily = (await family(treeId, null, null)).id;
        await addChildRef(parentsFamily, subject.id);
      }
      await addChildRef(parentsFamily, me.id);
    } else if (o.relation === "spouse" && !spouses.length) {
      await family(treeId, subject.id, me.id, FamilyType.MARRIED);
    }
  }
  await db.user.update({
    where: { id: userId },
    data: { personId: customerId, primaryTreeId: treeId },
  });
  await db.tree.updateMany({ where: { id: treeId, homePersonId: null }, data: { homePersonId: customerId } });

  // 5. Memorial and QR.
  const name = [o.first, o.surname].filter(Boolean).join(" ") || "Their";
  const memorial = await db.memorial.create({
    data: {
      personId: subject.id,
      treeId,
      slug: `${slugify(name) || "memorial"}-${randomToken(6)}`,
      headline: `In loving memory of ${name}`,
      eulogy: o.epitaph?.trim() || null,
      bornText: o.birth?.trim() || null,
      diedText: [o.death?.trim(), o.place?.trim()].filter(Boolean).join(" · ") || null,
      published: true,
      createdById: userId,
    },
    select: { id: true },
  });
  await db.qrCode.create({
    data: { code: randomToken(8), memorialId: memorial.id, personId: subject.id, treeId, orderItemId: item.id },
  });

  // 6. Freeze the layout, price the order, open the deposit.
  const price = unitPrice(item.product.basePriceKes, item.product.options as ProductOptions | null, o);
  const total = price * item.quantity;
  const deposit = depositFor(total);
  await db.orderItem.update({
    where: { id: item.id },
    data: {
      focusPersonId: subject.id,
      unitPriceKes: price,
      approvedAt: new Date(),
      layoutSnapshot: { ...o, name, memorialId: memorial.id, approvedAt: new Date().toISOString() },
    },
  });
  const settings = await getPaymentSettings();
  const payment = await db.payment.create({
    data: {
      workspaceId,
      treeId,
      orderId: order.id,
      userId,
      provider: settings.provider,
      kind: PaymentKind.ORDER_DEPOSIT,
      amountKes: deposit,
      currency: settings.currency,
      reference: paymentReference(),
      status: PaymentStatus.PENDING,
    },
    select: { id: true },
  });
  await db.order.update({
    where: { id: order.id },
    data: { userId, workspaceId, treeId, totalKes: total, depositKes: deposit, status: OrderStatus.AWAITING_DEPOSIT },
  });
  return { orderId: order.id, paymentId: payment.id };
}
