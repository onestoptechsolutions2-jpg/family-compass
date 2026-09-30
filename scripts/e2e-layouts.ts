// Every product layout, ordered through the real cart against a real database:
// what lands in the family record, what QR it gets, and what the printed sheet says.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-layouts.ts
import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { addItemToCart, getCart } from "../src/lib/cart";
import { checkoutCart } from "../src/lib/orders";
import { renderItemSheet } from "../src/lib/print-order";
import { isReady } from "../src/lib/layouts";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();
const delivery = { contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi" };

const NEW = [
  "memorial-prayer-cards", "family-birthday-calendar", "framed-family-tree-print", "reunion-tshirt",
  "reunion-name-badges", "reunion-banner", "wedding-family-tree",
];

/** Order one product on its own, return the user's tree and the item. */
async function order(slug: string, options: Record<string, string>, who = "Ann Kamau") {
  const user = await db.user.create({ data: { email: `${slug}-${RUN}@example.com`, name: who } });
  const item = await addItemToCart(user.id, slug, options);
  const cart = (await getCart(user.id))!;
  const res = await checkoutCart(user.id, cart.id, { ...delivery, contactName: who });
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const it = await db.orderItem.findUniqueOrThrow({ where: { id: item!.id }, include: { qrCode: true, product: true } });
  const sheet = await renderItemSheet(it.id);
  return { user: u, item: it, res, treeId: u.primaryTreeId!, svg: sheet?.sheet.svg ?? "", warnings: sheet?.sheet.warnings ?? [] };
}

const names = async (treeId: string) => {
  const rows = await db.name.findMany({ where: { person: { treeId } }, select: { first: true, surname: true } });
  return rows.map((r) => [r.first, r.surname].filter(Boolean).join(" "));
};

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  // ---- new products ship switched off, so no one can buy at a guessed price ------------------
  const fresh = await db.product.findMany({ where: { slug: { in: NEW } } });
  check("all seven new products exist", fresh.length === 7, fresh.map((p) => p.slug));
  await db.product.updateMany({ where: { slug: { in: NEW } }, data: { active: false } });
  check("new products are switched off until priced", (await db.product.count({ where: { slug: { in: NEW }, active: true } })) === 0);
  const probe = await db.user.create({ data: { email: `probe-${RUN}@example.com`, name: "Probe" } });
  check("a switched-off product cannot be added to a cart", (await addItemToCart(probe.id, "reunion-tshirt", { surname: "Kamau" })) === null);
  await db.product.updateMany({ where: { slug: { in: NEW } }, data: { active: true } }); // for this test only

  const aisles = Object.fromEntries(fresh.map((p) => [p.slug, p.aisle]));
  check("products sit in the right aisles", aisles["memorial-prayer-cards"] === "books_print" && aisles["family-birthday-calendar"] === "books_print" &&
    aisles["reunion-tshirt"] === "events_merch" && aisles["reunion-name-badges"] === "events_merch" && aisles["reunion-banner"] === "events_merch" &&
    aisles["wedding-family-tree"] === "events_merch" && aisles["framed-family-tree-print"] === "wall_art", aisles);
  const layouts = Object.fromEntries(fresh.map((p) => [p.slug, p.layout]));
  check("each product has its layout", layouts["memorial-prayer-cards"] === "card" && layouts["family-birthday-calendar"] === "calendar" &&
    layouts["reunion-tshirt"] === "shirt" && layouts["reunion-name-badges"] === "badges" && layouts["reunion-banner"] === "banner" &&
    layouts["wedding-family-tree"] === "wedding" && layouts["framed-family-tree-print"] === "tree", layouts);
  check("the framed print is a two-stage product", JSON.stringify(fresh.find((p) => p.slug === "framed-family-tree-print")!.skills) === '["printing","framing"]');

  // ---- readiness per layout ------------------------------------------------------------------------
  check("a card needs a first name", !isReady("card", { surname: "Kamau" }) && isReady("card", { first: "John" }));
  check("a calendar, badges and shirt need a family name", isReady("calendar", { surname: "K" }) && !isReady("badges", { first: "x" }) && isReady("shirt", { surname: "K" }));

  // ---- memorial prayer cards ----------------------------------------------------------------------------
  const card = await order("memorial-prayer-cards", { first: "John", surname: "Kamau", birth: "12 March 1948", death: "2026", epitaph: "Rest well, Baba", parents: "Peter Kamau\nMary Wanjiku", children: "Ann Kamau", relation: "child", sizeKey: "pack100" });
  check("card: checkout opens a payment", !!card.res);
  const cardMemorial = await db.memorial.findFirst({ where: { treeId: card.treeId } });
  check("card: builds a published memorial (the QR opens it)", !!cardMemorial?.published && card.item.qrCode?.memorialId === cardMemorial.id);
  check("card: the person has a death event", (await db.eventRef.count({ where: { person: { treeId: card.treeId }, event: { type: "Death" } } })) === 1);
  check("card: pack of 100 costs the base plus the pack step", card.item.unitPriceKes === 5000 + 3500, card.item.unitPriceKes);
  check("card: the printed card carries name, verse and QR", ["John Kamau", "IN LOVING MEMORY", "Rest well", "SCAN TO SEE THEIR MEMORIAL", "/q/"].every((t) => card.svg.includes(t)), card.svg.slice(0, 80));
  check("card: front and back on one sheet, A6 each", card.svg.includes('width="210mm" height="148mm"'));

  // ---- family birthday calendar ---------------------------------------------------------------------------------
  const cal = await order("family-birthday-calendar", {
    surname: "Kamau", first: "Ann", year: "2027", title: "The Kamau Family",
    birthdays: "Ann Kamau, 3 March 1985\nPeter Kamau, 17 March 1950\nLucy Otieno, 14 February 2012\nWedding anniversary, 14 December\nnot a date at all",
  });
  const calNames = await names(cal.treeId);
  check("calendar: people with a full birth date join the family", calNames.includes("Peter Kamau") && calNames.includes("Lucy Otieno"), calNames);
  check("calendar: an entry with no year is not made a person", !calNames.includes("Wedding anniversary"), calNames);
  check("calendar: the customer listing themselves is not duplicated", calNames.filter((n) => n === "Ann Kamau").length === 1, calNames);
  check("calendar: each dated person has a birth event", (await db.eventRef.count({ where: { person: { treeId: cal.treeId }, event: { type: "Birth" } } })) === 3);
  check("calendar: QR opens the shared family page", !!cal.item.qrCode?.sharedViewId);
  check("calendar: the sheet shows the year, the names and the age", ["2027", "The Kamau Family", "Peter Kamau (77)", "Lucy Otieno (15)", "Wedding anniversary"].every((t) => cal.svg.includes(t)));
  check("calendar: it warns about a line it cannot read", cal.warnings.some((w) => w.includes("not a date at all")), cal.warnings);

  // ---- framed print: a tree layout that goes through two partners ---------------------------------------------------------
  const framed = await order("framed-family-tree-print", { first: "Ann", surname: "Kamau", parents: "Peter Kamau\nMary Wanjiku", children: "Lucy Otieno" });
  check("framed print: paper skin, family tree, QR", framed.svg.includes("Peter Kamau") && framed.svg.includes("SCAN TO VIEW THE") && !!framed.item.qrCode?.sharedViewId);

  // ---- reunion T-shirt -------------------------------------------------------------------------------------------------------------
  const shirt = await order("reunion-tshirt", { surname: "Kamau", first: "Ann", title: "Family Reunion", year: "2026", place: "Kakamega", sizeKey: "tee_xl", parents: "Peter Kamau\nMary Wanjiku" });
  check("shirt: artwork has the family name, event, year and place", ["KAMAU", "FAMILY REUNION", "2026", "Kakamega", "SCAN FOR OUR FAMILY"].every((t) => shirt.svg.includes(t)));
  check("shirt: printed with no background, for a light shirt", !/<rect width="300" height="400"/.test(shirt.svg));
  check("shirt: the QR opens the family page and the family was built", !!shirt.item.qrCode?.sharedViewId && (await names(shirt.treeId)).includes("Peter Kamau"));

  // ---- reunion name badges --------------------------------------------------------------------------------------------------------------
  const badges = await order("reunion-name-badges", {
    title: "Kamau Family Reunion 2026", surname: "Kamau", first: "Peter",
    attendees: "Peter Kamau, Host\nMary Wanjiku, Aunt\nGrace Wanjiru Kamau, Grandmother\nBen Otieno, Nephew",
  });
  check("badges: one badge per guest with their relation", ["Mary Wanjiku", "Aunt of Peter", "Grace Wanjiru", "Nephew of Peter", "KAMAU FAMILY REUNION 2026"].every((t) => badges.svg.toUpperCase().includes(t.toUpperCase())));
  check("badges: the host's own badge does not say 'Host of Peter'", !badges.svg.includes("Host of"));
  check("badges: guests are not added to the family as people", !(await names(badges.treeId)).includes("Mary Wanjiku"));

  // ---- reunion banner ---------------------------------------------------------------------------------------------------------------------------
  const banner = await order("reunion-banner", { first: "Hesbon", surname: "Musungu", title: "Musungu Family Reunion 2026", parents: "Joseph Musungu\nSelpha Ndakala", fatherParents: "Omukoko Khamala\nRebecca Mukhuyu", children: "Willy Okusimba\nBilly Okusimba" });
  check("banner: the tree with the event title at banner size", banner.svg.includes("Musungu Family Reunion 2026") && banner.svg.includes("Omukoko") && banner.svg.includes('width="2000mm" height="1000mm"'));
  check("banner: names are large enough to read from a distance", banner.warnings.length === 0, banner.warnings);

  // ---- wedding family tree ------------------------------------------------------------------------------------------------------------------------
  const wedding = await order("wedding-family-tree", { first: "Ann", surname: "Kamau", spouse: "Tom Otieno", year: "14 December 2026", title: "The wedding of Ann and Tom", parents: "Peter Kamau\nMary Wanjiku", spouseParents: "David Otieno\nRuth Achieng", relation: "other" }, "Grace Kamau");
  const wn = await names(wedding.treeId);
  check("wedding: both partners and both sets of parents are in the family", ["Ann Kamau", "Tom Otieno", "Peter Kamau", "Mary Wanjiku", "David Otieno", "Ruth Achieng"].every((n) => wn.includes(n)), wn);
  const unions = await db.family.findMany({ where: { treeId: wedding.treeId }, include: { childRefs: true } });
  check("wedding: three unions: the couple and each set of parents", unions.length === 3, unions.length);
  const couple = unions.find((f) => f.partner1Id && f.partner2Id && f.childRefs.length === 0 && wn.length);
  check("wedding: the partner's parents have the partner as their child", unions.filter((f) => f.childRefs.length === 1).length === 2);
  check("wedding: the couple are living people", (await db.person.count({ where: { treeId: wedding.treeId, living: false } })) === 0);
  check("wedding: the customer is a separate person from the couple", (await db.person.count({ where: { treeId: wedding.treeId, claimedByUserId: wedding.user.id } })) === 1 && !!couple);
  check("wedding: the sheet joins both families under the title", ["The wedding of Ann and Tom", "14 December 2026", "Ruth Achieng", "David Otieno", "Tom Otieno"].every((t) => wedding.svg.includes(t)));
  check("wedding: the QR opens the family page", !!wedding.item.qrCode?.sharedViewId);

  // ---- the ones that already existed still behave ----------------------------------------------------------------------------------------------------
  const tomb = await order("tombstone-family-tree", { first: "John", surname: "Kamau", death: "2026", parents: "Peter Kamau\nMary Wanjiku", materialKey: "granite", sizeKey: "square", relation: "child" });
  check("tombstone tree: memorial, QR and a dagger on the sheet", !!tomb.item.qrCode?.memorialId && tomb.svg.includes("†"));

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
