// Prepare data and real sign-in sessions for driving the admin and partner pages by hand:
//   tsx scripts/prep-http.ts   -> prints JSON with cookies and ids
import { randomBytes } from "node:crypto";
import { PrismaClient, PaymentStatus } from "@prisma/client";

import { POLICY_VERSION } from "../src/lib/policy";
import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { fulfilDraft } from "../src/lib/orders";
import { fulfilPayment } from "../src/lib/payments/fulfil";

const db = new PrismaClient();
const tag = Date.now();
const agreed = { consentVersion: POLICY_VERSION, consentAt: new Date() };

async function session(userId: string) {
  const sessionToken = randomBytes(24).toString("hex");
  await db.session.create({ data: { sessionToken, userId, expires: new Date(Date.now() + 86400_000) } });
  return sessionToken;
}

await seedPaymentSettings(db);
await seedProducts(db);

const admin = await db.user.create({ data: { email: `admin-${tag}@example.com`, name: "Admin", isPlatformAdmin: true, ...agreed } });
const pUser = await db.user.create({ data: { email: `stone-${tag}@example.com`, name: "Stone Person", ...agreed } });
const other = await db.user.create({ data: { email: `other-${tag}@example.com`, name: "Other Person", ...agreed } });
const customer = await db.user.create({ data: { email: `cust-${tag}@example.com`, name: "Ann Kamau" } });

const partner = await db.partner.create({ data: { name: `StoneCo-${tag}`, skills: ["stone_engraving"], regions: ["Nairobi"], status: "ACTIVE" } });
await db.partnerMember.create({ data: { partnerId: partner.id, userId: pUser.id } });
const outsider = await db.partner.create({ data: { name: `WoodCo-${tag}`, skills: ["wood_engraving"], status: "ACTIVE" } });
await db.partnerMember.create({ data: { partnerId: outsider.id, userId: other.id } });
const invite = await db.partnerInvite.create({
  data: { partnerId: partner.id, email: `newbie-${tag}@example.com`, token: `inv_${tag}`, expiresAt: new Date(Date.now() + 86400_000) },
});

const product = await db.product.findUniqueOrThrow({ where: { slug: "tombstone-family-tree" } });
const token = `tok_${tag}`;
await db.order.create({
  data: {
    guestToken: token, contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi",
    items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: { first: "John", surname: "Kamau", birth: "1948", death: "2026", parents: "Peter Kamau\nMary Wanjiku", materialKey: "granite", sizeKey: "square" } } },
  },
});
const res = (await fulfilDraft(customer.id, token))!;
await db.payment.update({ where: { id: res.paymentId }, data: { status: PaymentStatus.AWAITING_VERIFICATION, mpesaCode: "HTTPTEST01" } });
await fulfilPayment(res.paymentId, { note: "http test" });
const job = await db.productionJob.findFirstOrThrow({ where: { orderItem: { orderId: res.orderId } } });

// a brand-new customer who has not accepted the policy, with a finished design waiting to be approved
const newCust = await db.user.create({ data: { email: `new-${tag}@example.com`, name: "New Customer" } });
const token2 = `tok2_${tag}`;
await db.order.create({
  data: {
    guestToken: token2, contactName: "New Customer", contactPhone: "0700", deliveryText: "Nairobi",
    items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: { first: "Jane", surname: "Doe", birth: "1950", death: "2025", materialKey: "granite", sizeKey: "square" } } },
  },
});

console.log(
  JSON.stringify({
    newCustCookie: await session(newCust.id),
    draftToken: token2,
    tag,
    adminCookie: await session(admin.id),
    partnerCookie: await session(pUser.id),
    otherCookie: await session(other.id),
    newbieEmail: invite.email,
    inviteToken: invite.token,
    partnerId: partner.id,
    outsiderId: outsider.id,
    orderId: res.orderId,
    jobId: job.id,
    itemId: job.orderItemId,
  }),
);
await db.$disconnect();
