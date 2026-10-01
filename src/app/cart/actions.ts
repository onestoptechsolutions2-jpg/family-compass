"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/rbac";
import { cartTotal, getCart, lineTotal, removeItem, setQuantity } from "@/lib/cart";
import { checkoutCart } from "@/lib/orders";
import { userConsentState } from "@/lib/consent";
import { notifyUser } from "@/lib/notify";
import { findMatchQuestions, parseAnswers } from "@/lib/matching";
import { db } from "@/lib/db";
import { isLayout, isReady } from "@/lib/layouts";
import type { DraftOptions } from "@/lib/order-shared";

export async function setQuantityAction(itemId: string, formData: FormData) {
  const user = await requireUser();
  await setQuantity(user.id, itemId, Number(formData.get("quantity")));
  revalidatePath("/cart");
}

export async function removeItemAction(itemId: string) {
  const user = await requireUser();
  await removeItem(user.id, itemId);
  revalidatePath("/cart");
}

const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Place the order: build the family data, open one payment, then go and pay. */
export async function checkoutAction(formData: FormData) {
  const user = await requireUser();
  const cart = await getCart(user.id);
  if (!cart || cart.items.length === 0) redirect("/cart");

  const delivery = {
    contactName: text(formData, "contactName", 120),
    contactPhone: text(formData, "contactPhone", 40),
    deliveryText: text(formData, "deliveryText", 500),
  };
  if (!delivery.contactName || !delivery.contactPhone || !delivery.deliveryText) {
    redirect("/cart?error=" + encodeURIComponent("Please fill in your name, phone and delivery address."));
  }
  if (cart.items.some((i) => !isReady(isLayout(i.product.layout) ? i.product.layout : "tree", (i.options ?? {}) as DraftOptions))) {
    redirect("/cart?error=" + encodeURIComponent("One of your items has no name on it. Remove it and personalise it again."));
  }

  // Every "is this someone already in your family?" must be answered, and an answer
  // can only be a person we offered, never an id someone typed in.
  const questions = await findMatchQuestions(user.id, cart.items);
  const answers = parseAnswers(formData);
  for (const q of questions) {
    const a = answers.get(q.itemId)?.[q.key];
    if (a !== "new" && !q.candidates.some((c) => c.id === a)) {
      redirect("/cart?error=" + encodeURIComponent(`Please tell us whether ${q.typed} is someone already in your family.`));
    }
  }
  for (const item of cart.items) {
    const mine = questions.filter((q) => q.itemId === item.id);
    if (!mine.length) continue;
    const chosen = Object.fromEntries(mine.map((q) => [q.key, answers.get(item.id)![q.key]!]));
    await db.orderItem.update({ where: { id: item.id }, data: { options: { ...((item.options ?? {}) as object), matches: chosen } } });
  }

  const result = await checkoutCart(user.id, cart.id, delivery);
  if (!result) redirect("/cart?error=" + encodeURIComponent("We could not place your order. Please try again."));

  // A new customer has not accepted the policy yet, and the app sends them to
  // /consent without remembering where they were going; send them ourselves.
  const pay = `/pay/${result.paymentId}`;
  // A receipt for the order, with the way back to pay if they leave the page.
  await notifyUser(user.id, {
    kind: "order.placed",
    title: "We received your order",
    body: `Pay KES ${cartTotal(cart.items).toLocaleString("en-KE")} by M-Pesa and we will start making it. Delivery is included.`,
    items: [...cart.items.map((i) => `${i.product.name} x ${i.quantity}: KES ${lineTotal(i).toLocaleString("en-KE")}`), `Total: KES ${cartTotal(cart.items).toLocaleString("en-KE")}`],
    button: "Pay now",
    linkPath: pay,
    email: true,
  });
  if ((await userConsentState(user.id)).stale) redirect(`/consent?next=${encodeURIComponent(pay)}`);
  redirect(pay);
}
