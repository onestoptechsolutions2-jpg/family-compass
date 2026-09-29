// The shop behaviours against a real database: a cart of several items, one payment,
// items that ship separately, and an order status that follows all of them.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-cart.ts
import { PrismaClient, PaymentStatus } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { addGuestDraftToCart, addItemToCart, cartCount, cartTotal, getCart, removeItem, setQuantity } from "../src/lib/cart";
import { checkoutCart, fulfilDraft } from "../src/lib/orders";
import { fulfilPayment } from "../src/lib/payments/fulfil";
import {
  acceptQuote, approveProof, dispatchItem, markItemDelivered, requestQuotes, shipJob, startProduction, submitProof, submitQuote,
} from "../src/lib/jobs";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();
const photo = { fileName: "done.jpg", mimeType: "image/jpeg", bytes: Buffer.from("fake") };
const delivery = { contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi" };
const orderStatus = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).status;

async function partner(base: string, skills: string[]) {
  const name = `${base}-${RUN}`;
  const user = await db.user.create({ data: { email: `${name}@example.com`, name } });
  const p = await db.partner.create({ data: { name, skills, status: "ACTIVE" } });
  await db.partnerMember.create({ data: { partnerId: p.id, userId: user.id } });
  return { p, user };
}

/** Quote, accept, make, photo, approve and ship one job. */
async function makeAndShip(jobId: string, pt: { p: { id: string }; user: { id: string } }) {
  await requestQuotes(jobId, [pt.p.id]);
  await submitQuote(pt.p.id, jobId, { costKes: 5000, leadDays: 3 });
  await acceptQuote((await db.jobQuote.findFirstOrThrow({ where: { jobId, partnerId: pt.p.id } })).id);
  await startProduction(pt.p.id, jobId);
  await submitProof(pt.p.id, jobId, photo, pt.user.id);
  await approveProof(jobId);
  await shipJob(pt.p.id, jobId, { trackingNote: "waybill 1" }, pt.user.id);
}

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);
  const user = await db.user.create({ data: { email: `shopper-${RUN}@example.com`, name: "Ann Kamau" } });
  const stranger = await db.user.create({ data: { email: `stranger-${RUN}@example.com`, name: "Stranger" } });

  // ---- a guest draft moves into the cart ---------------------------------------------
  const tomb = await db.product.findUniqueOrThrow({ where: { slug: "tombstone-family-tree" } });
  const token = `guest_${RUN}`;
  await db.order.create({
    data: { guestToken: token, items: { create: { productId: tomb.id, unitPriceKes: tomb.basePriceKes, options: { first: "John", surname: "Kamau", birth: "1948", death: "2026", materialKey: "granite", sizeKey: "square", parents: "Peter Kamau\nMary Wanjiku" } } } },
  });
  const cartId = (await addGuestDraftToCart(user.id, token))!;
  check("a guest draft moves into the customer's cart", (await db.orderItem.count({ where: { orderId: cartId } })) === 1);
  check("the same link twice finds the same cart", (await addGuestDraftToCart(user.id, token)) === cartId);
  check("someone else cannot take the draft", (await addGuestDraftToCart(stranger.id, token)) === null);

  // ---- more items, quantities -----------------------------------------------------------
  const plaque = await addItemToCart(user.id, "tile-plaque-qr", { first: "Mary", surname: "Kamau", birth: "1950", death: "2020", relation: "child" }, 2);
  check("a second product is added to the same cart", !!plaque && (await getCart(user.id))!.items.length === 2);
  check("cart count adds quantities", (await cartCount(user.id)) === 3, await cartCount(user.id));
  await setQuantity(user.id, plaque!.id, 99);
  check("quantity is capped at 20", (await db.orderItem.findUniqueOrThrow({ where: { id: plaque!.id } })).quantity === 20);
  await setQuantity(user.id, plaque!.id, 2);
  await setQuantity(stranger.id, plaque!.id, 7);
  check("another customer cannot change my cart", (await db.orderItem.findUniqueOrThrow({ where: { id: plaque!.id } })).quantity === 2);
  const extra = await addItemToCart(user.id, "family-tree-poster", { first: "Ann", surname: "Kamau" });
  await removeItem(stranger.id, extra!.id);
  check("another customer cannot remove my item", !!(await db.orderItem.findUnique({ where: { id: extra!.id } })));
  await removeItem(user.id, extra!.id);
  check("removing an item works", !(await db.orderItem.findUnique({ where: { id: extra!.id } })));
  check("an unknown or hidden product is not added", (await addItemToCart(user.id, "no-such-product", {})) === null);

  const cart = (await getCart(user.id))!;
  const expected = tomb.basePriceKes + (await db.product.findUniqueOrThrow({ where: { slug: "tile-plaque-qr" } })).basePriceKes * 2;
  check("cart total is the sum of lines, delivery included", cartTotal(cart.items) === expected, [cartTotal(cart.items), expected]);

  // ---- checkout ----------------------------------------------------------------------------
  check("checkout needs delivery details", (await checkoutCart(user.id, cart.id, { contactName: "", contactPhone: "", deliveryText: "" })) === null);
  check("checkout by someone else is refused", (await checkoutCart(stranger.id, cart.id, delivery)) === null);
  const res = (await checkoutCart(user.id, cart.id, delivery))!;
  check("checkout opens one payment for the whole basket", !!res, res);
  const payments = await db.payment.findMany({ where: { orderId: cart.id } });
  check("exactly one payment, for the full total", payments.length === 1 && payments[0]!.amountKes === expected, payments);
  const again = await checkoutCart(user.id, cart.id, delivery);
  check("checking out twice returns the same payment", again?.paymentId === res.paymentId && (await db.payment.count({ where: { orderId: cart.id } })) === 1);
  const items = await db.orderItem.findMany({ where: { orderId: cart.id }, include: { qrCode: true }, orderBy: { createdAt: "asc" } });
  check("every item is approved with its own QR", items.length === 2 && items.every((i) => !!i.approvedAt && !!i.qrCode?.code), items.map((i) => i.qrCode));
  check("the two QR codes differ", new Set(items.map((i) => i.qrCode!.code)).size === 2);
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  check("one family and one person for the customer across both items", !!u.primaryTreeId && (await db.person.count({ where: { claimedByUserId: user.id } })) === 1);
  check("a new cart starts empty after checkout", (await getCart(user.id)) === null);
  check("the guest link still finds the payment", (await fulfilDraft(user.id, token))?.paymentId === res.paymentId);

  // ---- pay, then production per item -------------------------------------------------------------
  await db.payment.update({ where: { id: res.paymentId }, data: { status: PaymentStatus.AWAITING_VERIFICATION, mpesaCode: "CARTTEST01" } });
  await fulfilPayment(res.paymentId, { note: "e2e" });
  check("payment opens one job per item", (await db.productionJob.count({ where: { orderItem: { orderId: cart.id } } })) === 2);
  check("order is paid, ready for production", (await orderStatus(cart.id)) === "DEPOSIT_VERIFIED");

  const stone = await partner("StoneCo", ["stone_engraving"]);
  const tile = await partner("TileCo", ["tile_printing"]);
  const stoneJob = await db.productionJob.findFirstOrThrow({ where: { orderItem: { orderId: cart.id }, skill: "stone_engraving" } });
  const tileJob = await db.productionJob.findFirstOrThrow({ where: { orderItem: { orderId: cart.id }, skill: "tile_printing" } });

  await makeAndShip(tileJob.id, tile);
  const tileItem = await db.orderItem.findUniqueOrThrow({ where: { id: tileJob.orderItemId } });
  check("the direct item is shipped to the customer on its own", !!tileItem.shippedAt && tileItem.customerTracking === "waybill 1");
  check("but the order is not shipped while the other item is still being made", (await orderStatus(cart.id)) === "IN_PRODUCTION");

  await makeAndShip(stoneJob.id, stone);
  const stoneItem = await db.orderItem.findUniqueOrThrow({ where: { id: stoneJob.orderItemId } });
  check("the item that comes to us first is not shipped to the customer yet", !stoneItem.shippedAt);
  check("so the order still is not shipped", (await orderStatus(cart.id)) === "IN_PRODUCTION");
  await dispatchItem(stoneItem.id, "Sendy 456");
  check("after our check it ships and the whole order is shipped", (await orderStatus(cart.id)) === "SHIPPED");

  await markItemDelivered(tileItem.id);
  check("one item delivered: the order is not delivered yet", (await orderStatus(cart.id)) === "SHIPPED");
  await markItemDelivered(stoneItem.id);
  check("all items delivered: the order is delivered", (await orderStatus(cart.id)) === "DELIVERED");
  check("the customer was told about their order", (await db.notification.count({ where: { userId: user.id, kind: "order.update" } })) >= 2);

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
