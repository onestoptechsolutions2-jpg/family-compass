// "Is this the same person already in your family?" against a real database.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-match.ts
import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { addItemToCart, getCart } from "../src/lib/cart";
import { findMatchQuestions } from "../src/lib/matching";
import { checkoutCart } from "../src/lib/orders";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();
const delivery = { contactName: "Ann Kamau", contactPhone: "0700", deliveryText: "Nairobi" };

async function newUser(tag: string) {
  return db.user.create({ data: { email: `${tag}-${RUN}@example.com`, name: "Ann Kamau" } });
}
async function place(userId: string, slug: string, options: Record<string, string>, answers?: (qs: Awaited<ReturnType<typeof findMatchQuestions>>) => Record<string, string>) {
  const item = (await addItemToCart(userId, slug, options))!;
  const cart = (await getCart(userId))!;
  const qs = await findMatchQuestions(userId, cart.items);
  if (answers) {
    const matches = answers(qs);
    await db.orderItem.update({ where: { id: item.id }, data: { options: { ...((cart.items[0]!.options ?? {}) as object), matches } } });
  }
  const res = await checkoutCart(userId, cart.id, delivery);
  return { qs, res, item };
}
const count = async (treeId: string) => ({
  people: await db.person.count({ where: { treeId } }),
  unions: await db.family.count({ where: { treeId } }),
  children: await db.childRef.count({ where: { person: { treeId } } }),
});
const treeOf = async (userId: string) => (await db.user.findUniqueOrThrow({ where: { id: userId } })).primaryTreeId!;

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  // ---- a first-time customer is asked nothing ------------------------------------------------------
  const u = await newUser("match");
  const first = await place(u.id, "tombstone-family-tree", {
    first: "John", surname: "Kamau", birth: "1948", death: "2026", parents: "Peter Kamau\nMary Wanjiku", materialKey: "granite", sizeKey: "square", relation: "child",
  });
  check("a first-time customer is asked nothing", first.qs.length === 0, first.qs);
  const tree = await treeOf(u.id);
  const base = await count(tree);
  check("the first order builds the family (John, Peter, Mary, Ann)", base.people === 4 && base.unions === 2, base);

  const find = async (name: string) => {
    const [first, ...rest] = name.split(" ");
    return db.person.findFirstOrThrow({ where: { treeId: tree, names: { some: { first, surname: rest.join(" ") } } } });
  };
  const mary = await find("Mary Wanjiku"), peter = await find("Peter Kamau"), john = await find("John Kamau");

  // ---- the same people, typed again: asked, and reused when the answer is yes ------------------------
  const second = await place(
    u.id,
    "tile-plaque-qr",
    { first: "Mary", surname: "Wanjiku", birth: "1950", death: "2020", spouse: "Peter Kamau", children: "John Kamau", relation: "other", sizeKey: "standard", materialKey: "tile" },
    (qs) => Object.fromEntries(qs.map((q) => [q.key, q.candidates[0]!.id])),
  );
  check("a returning customer is asked about every name that is already there", second.qs.length === 3, second.qs.map((q) => q.typed));
  check("the questions say who they are to the piece", second.qs.some((q) => q.role === "a spouse") && second.qs.some((q) => q.role === "a child") && second.qs.some((q) => q.role === "the person this is for"));
  check("the candidate is the person already there, with their birth year", second.qs.find((q) => q.typed === "Mary Wanjiku")!.candidates[0]!.id === mary.id);
  const after = await count(tree);
  check("answering yes adds no duplicate people", after.people === base.people, { base, after });
  check("answering yes adds no duplicate couple", after.unions === base.unions, { base, after });
  check("answering yes does not give John a second set of parents", after.children === base.children, { base, after });
  const maryNow = await db.person.findUniqueOrThrow({ where: { id: mary.id } });
  check("Mary, now known to have died, is no longer marked living", maryNow.living === false);
  check("Mary gets the death date the customer gave", (await db.eventRef.count({ where: { personId: mary.id, event: { type: "Death" } } })) === 1);
  check("Mary keeps her memorial page, made by this order", (await db.memorial.count({ where: { personId: mary.id } })) === 1);
  check("the order still got its own QR and payment", !!second.res && !!(await db.qrCode.findFirst({ where: { orderItemId: second.item.id } })));

  // ---- answering no keeps them apart, as the customer asked -------------------------------------------------------------
  const third = await place(
    u.id, "tile-plaque-qr",
    { first: "Peter", surname: "Kamau", death: "2019", relation: "other", sizeKey: "standard", materialKey: "tile" },
    (qs) => Object.fromEntries(qs.map((q) => [q.key, "new"])),
  );
  check("answering no makes a separate person", third.qs.length === 1 && (await count(tree)).people === after.people + 1, await count(tree));

  // ---- an id from someone else's family is never used -------------------------------------------------------------------------
  const stranger = await newUser("stranger");
  const other = await place(stranger.id, "tombstone-family-tree", { first: "Zed", surname: "Other", death: "2020", relation: "other", materialKey: "granite", sizeKey: "square" });
  const strangerPerson = await db.person.findFirstOrThrow({ where: { treeId: await treeOf(stranger.id), names: { some: { first: "Zed" } } } });
  const before4 = (await count(tree)).people;
  await place(
    u.id, "tile-plaque-qr",
    { first: "Zed", surname: "Other", death: "2021", relation: "other", sizeKey: "standard", materialKey: "tile" },
    () => ({ "zed other": strangerPerson.id }), // forged: not in this customer's family
  );
  check("a forged id for someone else's relative is ignored", (await count(tree)).people === before4 + 1 && !!other.res);
  check("the other family was left untouched", (await db.eventRef.count({ where: { personId: strangerPerson.id, event: { type: "Death" } } })) === 1);

  // ---- what counts as a possible match ---------------------------------------------------------------------------------------------------
  const probe = await addItemToCart(u.id, "family-tree-poster", {
    first: "Ann", surname: "Kamau", parents: "Peter James Kamau\nMary  wanjiku\nPaul Kamau", spouse: "ann kamau", children: "Anne Kamau",
  });
  const cartNow = (await getCart(u.id))!;
  const qs = await findMatchQuestions(u.id, cartNow.items.filter((i) => i.id === probe!.id));
  const typed = qs.map((q) => q.typed);
  check("a middle name does not hide a match (Peter James Kamau is Peter Kamau)", typed.includes("Peter James Kamau"), typed);
  check("extra spaces and capitals do not hide a match", typed.includes("Mary  wanjiku"), typed);
  check("a name nobody has is not asked about", !typed.includes("Paul Kamau"), typed);
  check("a different spelling is not guessed at (Anne is not Ann)", !typed.includes("Anne Kamau"), typed);
  const annQ = qs.find((q) => q.typed === "ann kamau");
  check("the customer's own person can be offered, marked as them", !!annQ?.candidates.some((c) => c.you), annQ);

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
