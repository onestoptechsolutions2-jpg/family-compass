"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { startDbSession } from "@/lib/session";
import { recordConsent, userConsentState } from "@/lib/consent";
import { checkoutCart, unitPrice, type ProductOptions } from "@/lib/orders";
import { findMatchQuestions, parseAnswers } from "@/lib/matching";
import { isLayout, isReady } from "@/lib/layouts";
import { notifyUser } from "@/lib/notify";
import { hitLimit } from "@/lib/api/rate-limit";
import { clientIpFromHeaders } from "@/lib/user-agent";
import { REF_COOKIE, normalisePhone, referrerForCheckout } from "@/lib/referrals";
import type { DraftOptions } from "@/lib/order-shared";

const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

/**
 * Step 3: pay. One form takes the name, the M-Pesa phone and where to deliver, and places the
 * order. A customer who is not signed in is given an account from their phone number, with no
 * password; they come back later with a sign-in link. A number that already has an account is
 * never signed in from here: its owner signs in first, so typing someone's number gets you nowhere.
 */
export async function payNow(token: string, formData: FormData) {
  const back = (msg: string): never => redirect(`/order/${token}?step=3&error=${encodeURIComponent(msg)}`);
  const ip = clientIpFromHeaders(await headers()) ?? "unknown";
  if (!hitLimit(`pay-now:${ip}`, 10, 600)) back("Too many tries. Please wait a few minutes and try again.");

  const order = await db.order.findUnique({
    where: { guestToken: token },
    include: { items: { include: { product: true }, take: 1 } },
  });
  const item = order?.items[0];
  if (!order || !item) redirect("/shop");
  if (order.status !== OrderStatus.DRAFT) {
    const dep = await db.payment.findFirst({ where: { orderId: order.id, kind: "ORDER_DEPOSIT" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    redirect(dep ? `/pay/${dep.id}` : "/orders");
  }
  const layout = isLayout(item.product.layout) ? item.product.layout : "tree";
  if (!isReady(layout, (item.options ?? {}) as DraftOptions)) redirect(`/order/${token}?step=1&error=${encodeURIComponent("Add a name first.")}`);

  const delivery = {
    contactName: text(formData, "contactName", 120),
    contactPhone: text(formData, "contactPhone", 40),
    deliveryText: text(formData, "deliveryText", 500),
  };
  // kept on the design straight away, so nothing typed is lost if something below needs fixing
  await db.order.update({
    where: { id: order.id },
    data: { contactName: delivery.contactName || null, contactPhone: delivery.contactPhone || null, deliveryText: delivery.deliveryText || null },
  });
  if (!delivery.contactName) back("Please add your name.");
  const phone = normalisePhone(delivery.contactPhone);
  if (!phone) back("Please add your M-Pesa number, e.g. 0712 345 678.");
  if (!delivery.deliveryText) back("Please say where to deliver it.");

  // Who is buying: the signed-in customer, or a new account from this phone number.
  let me = await getSessionUser();
  if (order.userId && order.userId !== me?.id) redirect("/shop");
  if (!me) {
    const taken = await db.user.findFirst({ where: { OR: [{ phone: phone! }, { email: `${phone}@wa.local` }] }, select: { id: true } });
    if (taken) back("That number already has an account. Sign in first, then come back to finish: nothing you entered is lost.");
    if (formData.get("agree") !== "on") back("Please agree to the terms to place your order.");
    const created = await db.user.create({ data: { name: delivery.contactName, email: `${phone}@wa.local`, phone: phone! }, select: { id: true } });
    await recordConsent(created.id, { research: false, marketing: false });
    await startDbSession(created.id);
    me = { id: created.id, email: `${phone}@wa.local`, name: delivery.contactName, image: null, isPlatformAdmin: false };
  } else if ((await userConsentState(me.id)).stale) {
    if (formData.get("agree") !== "on") back("Please agree to the terms to place your order.");
    await recordConsent(me.id, { research: false, marketing: false });
  }
  const userId = me.id;

  // A returning customer answers "is this someone already in your family?"; an answer can only
  // be a person we offered, never an id someone typed in.
  const questions = await findMatchQuestions(userId, [item]);
  const answers = parseAnswers(formData);
  for (const q of questions) {
    const a = answers.get(q.itemId)?.[q.key];
    if (a !== "new" && !q.candidates.some((c) => c.id === a)) back(`Please tell us whether ${q.typed} is someone already in your family.`);
  }
  if (questions.length) {
    const chosen = Object.fromEntries(questions.map((q) => [q.key, answers.get(item.id)![q.key]!]));
    await db.orderItem.update({ where: { id: item.id }, data: { options: { ...((item.options ?? {}) as object), matches: chosen } } });
  }

  // The design becomes this customer's order, and is placed and paid for on its own.
  await db.order.update({ where: { id: order.id }, data: { userId } });
  const linkCode = (await cookies()).get(REF_COOKIE)?.value ?? null;
  const referrerId = await referrerForCheckout(userId, text(formData, "referralCode", 40) || null, linkCode);
  const placed = await checkoutCart(userId, order.id, delivery, referrerId);
  if (!placed) back("We could not place your order. Please try again.");

  const price = unitPrice(item.product.basePriceKes, item.product.options as ProductOptions | null, (item.options ?? {}) as DraftOptions, item.product.layout) * item.quantity;
  await notifyUser(userId, {
    kind: "order.placed",
    title: "We received your order",
    body: `Pay KES ${price.toLocaleString("en-KE")} by M-Pesa and we will start making it. Delivery is included.`,
    button: "Pay now",
    linkPath: `/pay/${placed!.paymentId}`,
    email: true,
  });
  redirect(`/pay/${placed!.paymentId}`);
}
