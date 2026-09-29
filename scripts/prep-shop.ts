// A signed-in customer and a personalised guest draft, for driving the shop over HTTP:
//   tsx scripts/prep-shop.ts  -> prints JSON with a cookie and the draft token
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { POLICY_VERSION } from "../src/lib/policy";
import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";

const db = new PrismaClient();
const tag = Date.now();
await seedPaymentSettings(db);
await seedProducts(db);

const user = await db.user.create({
  data: { email: `shopper-${tag}@example.com`, name: "Ann Kamau", consentVersion: POLICY_VERSION, consentAt: new Date() },
});
const sessionToken = randomBytes(24).toString("hex");
await db.session.create({ data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 86400_000) } });

const product = await db.product.findUniqueOrThrow({ where: { slug: "tombstone-family-tree" } });
const token = `shop_${tag}`;
await db.order.create({
  data: {
    guestToken: token,
    items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: { first: "John", surname: "Kamau", birth: "1948", death: "2026", parents: "Peter Kamau\nMary Wanjiku", materialKey: "granite", sizeKey: "square", relation: "child" } } },
  },
});
console.log(JSON.stringify({ cookie: sessionToken, token, price: product.basePriceKes }));
await db.$disconnect();
