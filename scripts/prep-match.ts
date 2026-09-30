// A returning customer (family already built) with a second item in the cart, for driving the
// "is this someone already in your family?" question over HTTP:
//   tsx scripts/prep-match.ts  -> prints JSON with a cookie and the ids to answer with
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { POLICY_VERSION } from "../src/lib/policy";
import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { addItemToCart, getCart } from "../src/lib/cart";
import { checkoutCart } from "../src/lib/orders";

const db = new PrismaClient();
const tag = Date.now();
await seedPaymentSettings(db);
await seedProducts(db);

const user = await db.user.create({
  data: { email: `returning-${tag}@example.com`, name: "Ann Kamau", consentVersion: POLICY_VERSION, consentAt: new Date() },
});
const delivery = { contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi" };

// their first order builds the family
await addItemToCart(user.id, "tombstone-family-tree", {
  first: "John", surname: "Kamau", birth: "1948", death: "2026", parents: "Peter Kamau\nMary Wanjiku", materialKey: "granite", sizeKey: "square", relation: "child",
});
await checkoutCart(user.id, (await getCart(user.id))!.id, delivery);
const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
const find = (first: string, surname: string) =>
  db.person.findFirstOrThrow({ where: { treeId: u.primaryTreeId!, names: { some: { first, surname } } } });
const peter = await find("Peter", "Kamau");
const mary = await find("Mary", "Wanjiku");

// a second item that names people already there
const item = (await addItemToCart(user.id, "tile-plaque-qr", {
  first: "Mary", surname: "Wanjiku", birth: "1950", death: "2020", spouse: "Peter Kamau", relation: "other", sizeKey: "standard", materialKey: "tile",
}))!;
const other = await db.user.create({ data: { email: `other-${tag}@example.com`, name: "Other" } });
const foreign = await (async () => {
  await addItemToCart(other.id, "tombstone-family-tree", { first: "Zed", surname: "Other", death: "2020", relation: "other", materialKey: "granite", sizeKey: "square" });
  await checkoutCart(other.id, (await getCart(other.id))!.id, delivery);
  const o = await db.user.findUniqueOrThrow({ where: { id: other.id } });
  return db.person.findFirstOrThrow({ where: { treeId: o.primaryTreeId!, names: { some: { first: "Zed" } } } });
})();

const sessionToken = randomBytes(24).toString("hex");
await db.session.create({ data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 86400_000) } });
console.log(JSON.stringify({ cookie: sessionToken, itemId: item.id, peterId: peter.id, maryId: mary.id, foreignId: foreign.id, treeId: u.primaryTreeId }));
await db.$disconnect();
