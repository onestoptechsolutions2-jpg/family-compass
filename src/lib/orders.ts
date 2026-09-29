import { FamilyType, OrderStatus, PaymentKind, PaymentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { slugify, randomToken, paymentReference } from "@/lib/slug";
import { addChildRef, createBarePerson, setVitalEvent, type Db } from "@/lib/person-write";
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
    .slice(0, 40);
}

export function splitName(full: string): { first: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] ?? "", surname: "" };
  return { first: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] ?? "" };
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
      // flips DRAFT first wins, the other returns the deposit that one opened.
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

      // 1. Family container: the primary tree of this user, or a new one.
      let treeId = existingTreeId;
      if (!treeId) {
        const label = o.surname?.trim() || splitName(displayName).surname || displayName;
        const base = slugify(label) || "family";
        const tree = await tx.tree.create({
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

      // 2. The person the product is about. A Living product is about the
      // customer, so their own Person is the subject; a Remembered product is
      // about someone who has died, and the customer is added separately below.
      const isLiving = item.product.pathway === "LIVING";
      let customerId = user.personId;
      let subject: { id: string };
      if (isLiving) {
        if (customerId) {
          subject = { id: customerId };
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
          customerId = subject.id;
        }
        if (o.birth) await setVitalEvent(treeId, subject.id, "Birth", o.birth, "", tx);
      } else {
        subject = await createBarePerson(treeId, { first: o.first, surname: o.surname, living: false }, tx);
        if (o.birth) await setVitalEvent(treeId, subject.id, "Birth", o.birth, "", tx);
        if (o.death) await setVitalEvent(treeId, subject.id, "Death", o.death, o.place ?? "", tx);
      }

      // 3. Relatives.
      const parents = lines(o.parents);
      const siblings = lines(o.siblings);
      // Names already created, so a customer who lists themselves is not added twice.
      const byName = new Map<string, string>();
      const remember = (kind: string, name: string, id: string) => byName.set(`${kind}:${name.trim().toLowerCase()}`, id);
      let parentsFamily: string | null = null;
      if (parents.length || siblings.length) {
        const p1 = parents[0] ? (await person(tx, treeId, parents[0])).id : null;
        const p2 = parents[1] ? (await person(tx, treeId, parents[1])).id : null;
        parentsFamily = (await family(tx, treeId, p1, p2, p1 && p2 ? FamilyType.MARRIED : FamilyType.UNKNOWN)).id;
        await addChildRef(parentsFamily, subject.id, undefined, tx);
        for (const s of siblings) {
          const sib = await person(tx, treeId, s);
          remember("sibling", s, sib.id);
          await addChildRef(parentsFamily, sib.id, undefined, tx);
        }
      }

      const spouses = lines(o.spouse);
      const kids = lines(o.children);
      let unionFamily: string | null = null;
      if (spouses.length || kids.length) {
        const sp = spouses[0] ? (await person(tx, treeId, spouses[0])).id : null;
        if (sp && spouses[0]) remember("spouse", spouses[0], sp);
        unionFamily = (await family(tx, treeId, subject.id, sp, sp ? FamilyType.MARRIED : FamilyType.UNKNOWN)).id;
        for (const k of kids) {
          const kid = await person(tx, treeId, k);
          remember("child", k, kid.id);
          await addChildRef(unionFamily, kid.id, undefined, tx);
        }
      }

      // 4. The customer becomes a Person in this family, linked to their user.
      const listed = customerId ? undefined : byName.get(`${o.relation}:${displayName.trim().toLowerCase()}`);
      if (listed) {
        // The customer listed themselves among the relatives: that person is them.
        await tx.person.update({ where: { id: listed }, data: { claimedByUserId: userId } });
        customerId = listed;
      } else if (!customerId) {
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
        customerId = me.id;
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
      await tx.user.update({
        where: { id: userId },
        data: { personId: customerId, primaryTreeId: treeId },
      });
      await tx.tree.updateMany({ where: { id: treeId, homePersonId: null }, data: { homePersonId: customerId } });

      // 5. The page the QR opens: a published memorial, or a shared family view
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

      // 6. Freeze the layout, price the order, open the deposit.
      const price = unitPrice(item.product.basePriceKes, item.product.options as ProductOptions | null, o);
      const total = price * item.quantity;
      const deposit = depositFor(total);
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          focusPersonId: subject.id,
          unitPriceKes: price,
          approvedAt: new Date(),
          layoutSnapshot: { ...o, name, memorialId, sharedViewId, approvedAt: new Date().toISOString() },
        },
      });
      const payment = await tx.payment.create({
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
      await tx.order.update({
        where: { id: order.id },
        data: { userId, workspaceId, treeId, totalKes: total, depositKes: deposit, status: OrderStatus.AWAITING_DEPOSIT },
      });
      return { orderId: order.id, paymentId: payment.id };
    },
    { timeout: 30_000 },
  );
}
