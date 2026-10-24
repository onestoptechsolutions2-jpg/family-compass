// The funeral programme and referrals against a real database: a referrer signs up, a family
// orders a programme with a cover photo through the referrer's code, pays, and the referrer
// earns their share; the print file has every page and the photo; a cancelled order owes nothing.
//   DATABASE_URL=... AUTH_SECRET=x APP_URL=http://localhost:3000 tsx scripts/e2e-programme-referral.ts
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { addItemToCart } from "../src/lib/cart";
import { checkoutCart } from "../src/lib/orders";
import { fulfilPayment } from "../src/lib/payments/fulfil";
import { priceBreakdown, type ProductOptions } from "../src/lib/product-pricing";
import type { DraftOptions } from "../src/lib/order-shared";
import { cancelCommission, recordCommission, referrerForCheckout, uniqueCode } from "../src/lib/referrals";
import { renderItemSheet } from "../src/lib/print-order";
import { sheetPdf } from "../src/lib/print-file";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();
const delivery = { contactName: "Jane Okusimba", contactPhone: "0700111222", deliveryText: "Ematsuli, Vihiga" };

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);
  const prog = await db.product.update({ where: { slug: "funeral-programme" }, data: { active: true } });

  // a funeral home signs up as a referrer
  const homeUser = await db.user.create({ data: { email: `home-${RUN}@example.com`, name: "Upendo Funeral Home" } });
  const code = await uniqueCode("Upendo Funeral Home");
  check("a referral code is made from the name", code.startsWith("UPENDO"), code);
  const ref = await db.referrer.create({ data: { userId: homeUser.id, name: "Upendo Funeral Home", kind: "funeral_home", payoutPhone: "254712345678", code } });

  // a family designs a programme with a cover photo
  const family = await db.user.create({ data: { email: `family-${RUN}@example.com`, name: "Jane Okusimba" } });
  const jpg = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#7a5a48" } }).jpeg().toBuffer();
  const photo = await db.draftPhoto.create({ data: { bytes: new Uint8Array(jpg), width: 800, height: 1000 } });
  const options: DraftOptions = {
    first: "Hesbon", surname: "Musungu", birth: "1948", death: "2026", photoId: photo.id,
    serviceWhen: "Saturday 14 November 2026, 10am", venue: "Ematsuli", place: "Ematsuli",
    service: "9:00 Arrival of the body\n10:00 Eulogy", bio: "A teacher for thirty-five years.",
    children: "Jane Okusimba\nWilly Okusimba", relation: "child",
    materialKey: "gloss", finishKey: "colour", sizeKey: "a5", pagesKey: "8", copiesKey: "200",
  };
  await addItemToCart(family.id, prog.slug, options);
  const cart = await db.order.findFirstOrThrow({ where: { userId: family.id, status: "DRAFT" } });

  // the family's own code would not count; the funeral home's does
  check("nobody earns on their own order", (await referrerForCheckout(homeUser.id, code, null)) === null);
  const referrerId = await referrerForCheckout(family.id, code.toLowerCase(), null);
  check("the typed code credits the funeral home", referrerId === ref.id, referrerId);

  const res = await checkoutCart(family.id, cart.id, delivery, referrerId);
  check("checkout opens one payment", !!res, res);
  if (!res) return;
  const order = await db.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { payments: true, items: true } });
  const expected = priceBreakdown(prog.basePriceKes, prog.options as ProductOptions, "programme", options).total;
  check("the price is base + per copy x 200", order.totalKes === expected && expected === 1500 + 200 * (10 + 30), [order.totalKes, expected]);
  check("the order carries the referrer", order.referrerId === ref.id);

  const memorial = await db.memorial.findFirstOrThrow({ where: { treeId: order.treeId! }, orderBy: { createdAt: "desc" } });
  check("the photo became the memorial cover", !!memorial.coverMediaId);
  check("the life story is the eulogy", memorial.eulogy === "A teacher for thirty-five years.", memorial.eulogy);
  check("the service details are on the memorial", (memorial.serviceText ?? "").includes("Ematsuli") && (memorial.serviceText ?? "").includes("Arrival"), memorial.serviceText);

  check("nothing is earned before the money is in", (await db.referralCommission.count({ where: { orderId: order.id } })) === 0);
  await fulfilPayment(order.payments[0]!.id, { verifiedById: null });
  const c = await db.referralCommission.findUnique({ where: { orderId: order.id } });
  check("paying earns the referrer 10%", c?.amountKes === Math.floor(order.depositKes / 10) && c?.percent === 10 && c?.status === "PENDING", c);
  await recordCommission(order.id, order.depositKes);
  check("a second approval earns nothing more", (await db.referralCommission.count({ where: { orderId: order.id } })) === 1);
  check("the referrer is told", (await db.notification.count({ where: { userId: homeUser.id, kind: "referral.earned" } })) === 1);

  // the print file: every page, the photo on the cover
  const sheet = await renderItemSheet(order.items[0]!.id);
  check("the print file has the 8 pages chosen", sheet?.sheet.pages?.length === 8, sheet?.sheet.pages?.length);
  check("the cover carries the photo", (sheet?.sheet.pages?.[0] ?? "").includes("data:image/jpeg;base64,"));
  const pdf = sheet ? await sheetPdf(sheet.sheet) : new Uint8Array();
  check("the PDF is made", pdf.length > 10_000 && Buffer.from(pdf.slice(0, 5)).toString() === "%PDF-", pdf.length);

  // a cancelled order owes nothing; a paid-out one is kept
  await cancelCommission(order.id);
  check("cancelling the order cancels what was owed", (await db.referralCommission.findUnique({ where: { orderId: order.id } }))?.status === "CANCELLED");

  // a suspended referrer earns nothing new
  await db.referrer.update({ where: { id: ref.id }, data: { status: "SUSPENDED" } });
  check("a paused referrer is not credited", (await referrerForCheckout(family.id, code, null)) === null);

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(failed ? 1 : 0);
  });
