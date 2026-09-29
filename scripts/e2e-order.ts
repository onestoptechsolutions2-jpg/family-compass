// End-to-end check of the money path against a real database:
// draft -> approve (family built) -> deposit -> admin verify -> QR resolves.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-order.ts
import { PrismaClient, PaymentStatus } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { fulfilDraft } from "../src/lib/orders";
import { fulfilPayment } from "../src/lib/payments/fulfil";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};

async function run(slug: string, options: Record<string, string>, contactName: string) {
  const product = await db.product.findUniqueOrThrow({ where: { slug } });
  const user = await db.user.create({
    data: { email: `${slug}-${Date.now()}@example.com`, name: contactName },
  });
  const token = `tok_${slug}_${Date.now()}`;
  await db.order.create({
    data: {
      guestToken: token,
      contactName,
      contactPhone: "0700000000",
      deliveryText: "Nairobi",
      items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options } },
    },
  });

  const res = await fulfilDraft(user.id, token);
  check(`${slug}: approve returns a deposit`, !!res, res);
  if (!res) return;

  const order = await db.order.findUniqueOrThrow({
    where: { id: res.orderId },
    include: { items: { include: { qrCode: true } }, payments: true },
  });
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  check(`${slug}: user linked to a person`, !!u.personId, u);
  check(`${slug}: user has a primary tree`, !!u.primaryTreeId, u);
  check(`${slug}: person is claimed by the user`, !!(await db.person.findFirst({ where: { id: u.personId ?? "", claimedByUserId: user.id } })));
  check(`${slug}: order awaiting deposit`, order.status === "AWAITING_DEPOSIT", order.status);
  check(`${slug}: total = base price`, order.totalKes === product.basePriceKes, order.totalKes);
  check(`${slug}: deposit is half`, order.depositKes === Math.ceil(order.totalKes / 2 / 100) * 100, order.depositKes);
  check(`${slug}: one deposit payment for the deposit amount`, order.payments.length === 1 && order.payments[0]!.amountKes === order.depositKes, order.payments);
  const item = order.items[0]!;
  check(`${slug}: layout frozen`, !!item.layoutSnapshot && !!item.approvedAt);
  check(`${slug}: QR minted`, !!item.qrCode?.code);
  check(`${slug}: QR points at a page`, !!(item.qrCode?.memorialId || item.qrCode?.sharedViewId), item.qrCode);

  // double approve must not build the family twice
  const again = await fulfilDraft(user.id, token);
  check(`${slug}: second approve returns the same deposit`, again?.paymentId === res.paymentId, again);
  const people = await db.person.count({ where: { treeId: u.primaryTreeId! } });
  const again2 = await fulfilDraft(user.id, token);
  check(`${slug}: no duplicate people on repeat`, (await db.person.count({ where: { treeId: u.primaryTreeId! } })) === people && !!again2);

  // customer submits code, admin verifies
  await db.payment.update({
    where: { id: res.paymentId },
    data: { status: PaymentStatus.AWAITING_VERIFICATION, mpesaCode: "TEST123ABC" },
  });
  const paid = await fulfilPayment(res.paymentId, { verifiedById: null, note: "e2e" });
  check(`${slug}: verify payment ok`, paid.ok, paid);
  const after = await db.order.findUniqueOrThrow({ where: { id: res.orderId } });
  check(`${slug}: order deposit verified`, after.status === "DEPOSIT_VERIFIED", after.status);
  const again3 = await fulfilPayment(res.paymentId, {});
  check(`${slug}: verify twice is idempotent`, again3.ok && again3.alreadyPaid === true, again3);

  return { u, item };
}

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  const plaque = await run(
    "tile-plaque-qr",
    {
      first: "John",
      surname: "Kamau",
      birth: "1948",
      death: "2026",
      place: "Nyeri",
      epitaph: "Rest well",
      parents: "Peter Kamau\nMary Wanjiku",
      spouse: "Grace Kamau",
      children: "Ann Kamau\nJames Kamau",
      siblings: "Paul Kamau",
      materialKey: "tile",
      sizeKey: "standard",
      relation: "child",
    },
    "Ann Kamau",
  );
  if (plaque) {
    const treeId = plaque.u.primaryTreeId!;
    const memorial = await db.memorial.findFirstOrThrow({ where: { treeId } });
    check("plaque: memorial published", memorial.published && !!memorial.groupContribToken);
    const kin = await db.person.count({ where: { treeId } });
    check("plaque: family graph built, customer not duplicated (7 people)", kin === 7, kin);
    const fams = await db.family.count({ where: { treeId } });
    check("plaque: two unions (parents, spouse)", fams === 2, fams);
    const born = await db.eventRef.count({ where: { person: { treeId }, event: { type: "Death" } } });
    check("plaque: death event recorded", born === 1, born);
  }

  const poster = await run(
    "family-tree-poster",
    {
      first: "Ann",
      surname: "Kamau",
      birth: "1980",
      parents: "John Kamau\nGrace Kamau",
      spouse: "Tom Otieno",
      children: "Lucy Otieno",
      siblings: "James Kamau",
      materialKey: "poster",
      sizeKey: "a2",
      relation: "other",
    },
    "Ann Kamau",
  );
  if (poster) {
    const view = await db.sharedView.findFirst({ where: { treeId: poster.u.primaryTreeId! } });
    check("poster: shared family view with claims on", !!view && view.allowClaims && view.includeLiving, view);
    check("poster: focus person is the customer", view?.centralPersonId === poster.u.personId);
    const memorials = await db.memorial.count({ where: { treeId: poster.u.primaryTreeId! } });
    check("poster: no memorial created", memorials === 0, memorials);
  }

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
