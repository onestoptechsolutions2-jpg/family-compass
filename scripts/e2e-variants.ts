// Variants and generation pricing against a real database: what is charged is what was shown.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-variants.ts
import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, seedProducts, seedVariants } from "../prisma/seed-lib";
import { addGuestDraftToCart, getCart } from "../src/lib/cart";
import { cartTotal } from "../src/lib/cart";
import { checkoutCart } from "../src/lib/orders";
import { priceBreakdown, type ProductOptions } from "../src/lib/product-pricing";
import { renderItemSheet } from "../src/lib/print-order";
import { renderPrintSheet } from "../src/lib/print-sheet";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();
const delivery = { contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi" };

async function draft(slug: string, options: object) {
  const product = await db.product.findUniqueOrThrow({ where: { slug } });
  const token = `v_${slug}_${RUN}_${Math.floor(Math.random() * 1e6)}`;
  await db.order.create({ data: { guestToken: token, items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options } } } });
  return token;
}

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  // ---- the catalogue ------------------------------------------------------------------------------------
  const all = await db.product.findMany();
  check("every product is on sale", all.every((p) => p.active), all.filter((p) => !p.active).map((p) => p.slug));
  const wood = await db.product.findUniqueOrThrow({ where: { slug: "wooden-family-tree" } });
  const wo = wood.options as ProductOptions;
  check("the wooden tree has colours and a generation rule", (wo.finishes?.length ?? 0) === 2 && wo.generations?.included === 2, wo);
  check("every product that draws a tree has a generation rule", all.filter((p) => ["tree", "banner", "wedding"].includes(p.layout)).every((p) => (p.options as ProductOptions).generations), "missing");
  check("a card, a calendar, badges and a shirt have no generation charge", all.filter((p) => ["card", "calendar", "badges", "shirt"].includes(p.layout)).every((p) => !(p.options as ProductOptions).generations));
  check("the shirt comes in colours", ((await db.product.findUniqueOrThrow({ where: { slug: "reunion-tshirt" } })).options as ProductOptions).finishes!.length === 4);

  // a price an admin changed is kept when the catalogue is seeded again
  await db.product.update({ where: { id: wood.id }, data: { options: { ...wo, generations: { included: 2, perExtraKes: 2500 } } } });
  await seedVariants(db);
  const again = (await db.product.findUniqueOrThrow({ where: { id: wood.id } })).options as ProductOptions;
  check("an admin's price survives seeding again", again.generations?.perExtraKes === 2500, again.generations);
  await db.product.update({ where: { id: wood.id }, data: { options: wo as object } });

  // ---- what is charged is what was shown ---------------------------------------------------------------------------
  const user = await db.user.create({ data: { email: `variants-${RUN}@example.com`, name: "Ann Kamau" } });
  const options = {
    first: "Ann", surname: "Kamau", materialKey: "wood", finishKey: "dark", sizeKey: "wall",
    parents: "Peter Kamau\nMary Wanjiku", fatherParents: "Omukoko Khamala\nRebecca Mukhuyu", children: "Lucy\nBen",
  };
  const shown = priceBreakdown(wood.basePriceKes, wo, "tree", options);
  check("four generations: base + walnut + two extra generations", shown.total === wood.basePriceKes + 1500 + 2 * 2000 && shown.generations === 4, shown);

  const token = await draft("wooden-family-tree", options);
  const cartId = (await addGuestDraftToCart(user.id, token))!;
  const cart = (await getCart(user.id))!;
  check("the cart total equals the price shown", cartTotal(cart.items) === shown.total, [cartTotal(cart.items), shown.total]);
  const res = await checkoutCart(user.id, cartId, delivery);
  check("the order is placed", !!res);
  const item = await db.orderItem.findFirstOrThrow({ where: { orderId: cartId } });
  check("the line is charged what was shown", item.unitPriceKes === shown.total, [item.unitPriceKes, shown.total]);
  const pay = await db.payment.findFirstOrThrow({ where: { orderId: cartId }, orderBy: { createdAt: "desc" } });
  check("and so is the payment", pay.amountKes === shown.total, [pay.amountKes, shown.total]);
  const snap = item.layoutSnapshot as Record<string, string>;
  check("the choices are frozen with the design", snap.finishKey === "dark" && snap.sizeKey === "wall" && snap.materialKey === "wood", snap);

  // ---- the look follows the choice ------------------------------------------------------------------------------------
  const dark = (await renderItemSheet(item.id))!.sheet;
  check("walnut is drawn in the walnut colour", dark.skin === "walnut" && dark.svg.includes("#6b4328"), dark.skin);
  const sheetFor = (productName: string, layout: "tree" | "shirt", o: Record<string, string>) =>
    renderPrintSheet({ options: o, productName, qrUrl: "https://example.com/q/x", pathway: "LIVING", layout }, o.sizeKey);
  const light = await sheetFor("Wooden tree", "tree", { ...options, finishKey: "light" });
  check("light oak is drawn in the oak colour", light.skin === "wood", light.skin);

  // ---- a shirt: the ink follows the shirt ------------------------------------------------------------------------------------
  const onWhite = await sheetFor("Shirt", "shirt", { surname: "Kamau", finishKey: "white", sizeKey: "tee_m" });
  const onBlack = await sheetFor("Shirt", "shirt", { surname: "Kamau", finishKey: "black", sizeKey: "tee_m" });
  check("on a white shirt the print is dark", onWhite.svg.includes('fill="#111111"'));
  check("on a black shirt the print is light, so it shows", onBlack.svg.includes('fill="#f3f3f3"') && !onBlack.svg.includes('fill="#111111"'));

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
