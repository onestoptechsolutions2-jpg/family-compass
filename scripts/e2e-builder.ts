// The tap-the-tree builder's server side against a real database:
// saving, cleaning, refusing, and turning a half-built tree into the right family.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-builder.ts
import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { autosaveBuilder } from "../src/app/order/[token]/builder-actions";
import { addGuestDraftToCart, getCart } from "../src/lib/cart";
import { findMatchQuestions } from "../src/lib/matching";
import { checkoutCart } from "../src/lib/orders";
import { renderItemSheet } from "../src/lib/print-order";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();
const delivery = { contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi" };

async function draft(slug: string, options: object = {}) {
  const product = await db.product.findUniqueOrThrow({ where: { slug } });
  const token = `b_${slug}_${RUN}_${Math.floor(Math.random() * 1e6)}`;
  await db.order.create({ data: { guestToken: token, items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options } } } });
  return token;
}
const optionsOf = async (token: string) =>
  ((await db.orderItem.findFirstOrThrow({ where: { order: { guestToken: token } } })).options ?? {}) as Record<string, unknown>;

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  // ---- saving ----------------------------------------------------------------------------------------
  const token = await draft("family-tree-poster", { materialKey: "poster", sizeKey: "a2" });
  const tree = {
    first: "Ann", surname: "Kamau", parents: "\nMary Wanjiku", motherParents: "\nNjeri", children: "Lucy\nBen", spouse: "Tom Otieno",
    // things a browser must never be able to set:
    materialKey: "a1", sizeKey: "a1", unitPriceKes: 1, matches: { "mary wanjiku": "someone-elses-id" }, __proto__: { isAdmin: true },
  };
  check("a save is accepted for an open draft", (await autosaveBuilder(token, JSON.stringify(tree))).ok);
  const saved = await optionsOf(token);
  check("the tree's answers are saved", saved.first === "Ann" && saved.parents === "\nMary Wanjiku" && saved.children === "Lucy\nBen" && saved.spouse === "Tom Otieno", saved);
  check("the mother's place is kept (she is not the father)", saved.parents === "\nMary Wanjiku");
  check("the material and size are not taken from the browser", saved.materialKey === "poster" && saved.sizeKey === "a2", saved);
  check("a price or an answer cannot be injected", saved.unitPriceKes === undefined && saved.matches === undefined, saved);
  const price = (await db.orderItem.findFirstOrThrow({ where: { order: { guestToken: token } } })).unitPriceKes;
  check("the price on the item is untouched", price === 8000, price);

  // ---- refusals --------------------------------------------------------------------------------------------
  check("a save that is not JSON is refused", !(await autosaveBuilder(token, "{not json")).ok);
  check("an oversize save is refused", !(await autosaveBuilder(token, JSON.stringify({ first: "x".repeat(25000) }))).ok);
  check("a save for a link that does not exist is refused", !(await autosaveBuilder("no-such-link", JSON.stringify({ first: "x" }))).ok);
  const before = JSON.stringify(await optionsOf(token));
  await autosaveBuilder(token, JSON.stringify({ first: "Evil\n\nInjected", children: Array.from({ length: 80 }, (_, i) => `K${i}`).join("\n") }));
  const after = await optionsOf(token);
  check("a name cannot smuggle in a second entry", after.first === "Evil Injected", after.first);
  check("a list is capped", String(after.children).split("\n").length === 20, String(after.children).split("\n").length);
  void before;
  await autosaveBuilder(token, JSON.stringify(tree)); // put it back

  // ---- a finished order's link can no longer be changed -------------------------------------------------------
  const user = await db.user.create({ data: { email: `builder-${RUN}@example.com`, name: "Ann Kamau" } });
  const cartId = (await addGuestDraftToCart(user.id, token))!;
  check("after the draft moved into a cart its link stops saving", !(await autosaveBuilder(token, JSON.stringify({ first: "Changed" }))).ok);

  // ---- a half-built tree becomes the right family ----------------------------------------------------------------
  const res = await checkoutCart(user.id, cartId, delivery);
  check("the order is placed", !!res);
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const names = (await db.name.findMany({ where: { person: { treeId: u.primaryTreeId! } }, select: { first: true, surname: true } })).map((n) => [n.first, n.surname].filter(Boolean).join(" "));
  check("everyone on the tree is in the family", ["Ann Kamau", "Mary Wanjiku", "Njeri", "Lucy", "Ben", "Tom Otieno"].every((n) => names.includes(n)), names);
  check("nobody was invented: six people exactly", names.length === 6, names);
  const mary = await db.person.findFirstOrThrow({ where: { treeId: u.primaryTreeId!, names: { some: { first: "Mary" } } } });
  const parents = await db.family.findMany({ where: { treeId: u.primaryTreeId!, childRefs: { some: { personId: u.personId! } } } });
  check("Ann's parents: a family with only a mother in it", parents.length === 1 && parents[0]!.partner2Id === mary.id && parents[0]!.partner1Id === null, parents);
  const njeri = await db.person.findFirstOrThrow({ where: { treeId: u.primaryTreeId!, names: { some: { first: "Njeri" } } } });
  const maryParents = await db.family.findMany({ where: { treeId: u.primaryTreeId!, childRefs: { some: { personId: mary.id } } } });
  check("Mary's parents: Njeri is her mother, with no father recorded", maryParents.length === 1 && maryParents[0]!.partner2Id === njeri.id && maryParents[0]!.partner1Id === null, maryParents);
  const couple = await db.family.findFirst({ where: { treeId: u.primaryTreeId!, partner1Id: u.personId!, partner2Id: { not: null } }, include: { childRefs: true } });
  check("Ann and Tom are a couple with their two children", !!couple && couple.childRefs.length === 2, couple);

  // ---- and it prints as it was built ---------------------------------------------------------------------------------------
  const item = (await db.orderItem.findFirstOrThrow({ where: { orderId: cartId } }));
  const sheet = (await renderItemSheet(item.id))!.sheet;
  check("the printed sheet shows the mother and her mother", sheet.svg.includes("Mary") && sheet.svg.includes("Njeri"));
  check("the printed sheet has no empty places or tap markers", !sheet.svg.includes("data-slot") && !sheet.svg.includes("tb-ghost"));
  check("the printed sheet has no 'Father' placeholder", !sheet.svg.includes(">Father<") && !sheet.svg.includes("+"), "placeholder text in print");
  check("the sheet has no warnings", sheet.warnings.length === 0, sheet.warnings);

  // ---- a second order typing the same mother is asked about her -------------------------------------------------------------
  const token2 = await draft("family-tree-poster", { materialKey: "poster", sizeKey: "a2" });
  await autosaveBuilder(token2, JSON.stringify({ first: "Ann", surname: "Kamau", parents: "\nMary Wanjiku" }));
  await addGuestDraftToCart(user.id, token2);
  const qs = await findMatchQuestions(user.id, (await getCart(user.id))!.items);
  check("the mother typed again in the builder is recognised as already in the family", qs.some((q) => q.typed === "Mary Wanjiku" && q.role === "a parent"), qs.map((q) => q.typed));

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
