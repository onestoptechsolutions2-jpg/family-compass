// End-to-end check of production against a real database:
// paid order -> jobs -> partner chosen -> quote -> assigned -> made -> photo approved -> shipped -> delivered -> paid out.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-jobs.ts
import { PrismaClient, PaymentStatus } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { fulfilDraft } from "../src/lib/orders";
import { fulfilPayment } from "../src/lib/payments/fulfil";
import {
  acceptQuote, approveProof, dispatchToCustomer, eligiblePartners, jobForPartner, markDelivered,
  recordPayout, rejectProof, requestQuotes, shipJob, startProduction, submitProof, submitQuote, JobError,
} from "../src/lib/jobs";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const throwsJob = async (name: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    check(name, false, "did not throw");
  } catch (e) {
    check(name, e instanceof JobError, String(e));
  }
};

const RUN = Date.now(); // partners are named per run so the script can be re-run on the same database
const photo = { fileName: "done.jpg", mimeType: "image/jpeg", bytes: Buffer.from("fake-jpeg-bytes") };

async function partner(base: string, skills: string[]) {
  const name = `${base}-${RUN}`;
  const user = await db.user.create({ data: { email: `${name}@example.com`, name } });
  const p = await db.partner.create({ data: { name, skills, regions: ["Nairobi"], status: "ACTIVE" } });
  await db.partnerMember.create({ data: { partnerId: p.id, userId: user.id } });
  return { p, user };
}

/** A paid order for a product, ready for production. */
async function paidOrder(slug: string, tag: string) {
  const product = await db.product.findUniqueOrThrow({ where: { slug } });
  const user = await db.user.create({ data: { email: `${tag}-${Date.now()}@example.com`, name: "Ann Kamau" } });
  const token = `tok_${tag}_${Date.now()}`;
  await db.order.create({
    data: {
      guestToken: token, contactName: "Ann Kamau", contactPhone: "0700", deliveryText: "Nairobi",
      items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: { first: "John", surname: "Kamau", birth: "1948", death: "2026", materialKey: "granite", sizeKey: "square" } } },
    },
  });
  const res = (await fulfilDraft(user.id, token))!;
  await db.payment.update({ where: { id: res.paymentId }, data: { status: PaymentStatus.AWAITING_VERIFICATION, mpesaCode: "E2ECODE01" } });
  await fulfilPayment(res.paymentId, { note: "e2e" });
  return res.orderId;
}

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  const stone = await partner("StoneCo", ["stone_engraving"]);
  const stone2 = await partner("Stone2", ["stone_engraving"]);
  const wood = await partner("WoodCo", ["wood_engraving"]);
  await db.partner.create({ data: { name: `AppliedStone-${RUN}`, skills: ["stone_engraving"], status: "APPLIED" } });

  // ---- via-us product (tombstone) -------------------------------------------------
  const orderId = await paidOrder("tombstone-family-tree", "tomb");
  const jobs = await db.productionJob.findMany({ where: { orderItem: { orderId } } });
  check("payment verified opens exactly one job", jobs.length === 1 && jobs[0]!.skill === "stone_engraving" && jobs[0]!.status === "OPEN", jobs);
  const job = jobs[0]!;
  check("order shows paid, ready for production", (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status === "DEPOSIT_VERIFIED");

  const elig = (await eligiblePartners(job.id)).map((p) => p.name).filter((n) => n.endsWith(`-${RUN}`)).sort();
  check("eligible = active partners with the speciality only", elig.join() === `Stone2-${RUN},StoneCo-${RUN}`, elig);

  await throwsJob("cannot ask a partner without the speciality", () => requestQuotes(job.id, [wood.p.id]));
  await requestQuotes(job.id, [stone.p.id, stone2.p.id]);
  check("job is waiting for quotes", (await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status === "QUOTING");
  check("a partner sees a job they were asked to quote", !!(await jobForPartner(stone.p.id, job.id)));
  check("a partner who was not asked cannot see it", (await jobForPartner(wood.p.id, job.id)) === null);

  await throwsJob("cannot quote a job you were not asked about", () => submitQuote(wood.p.id, job.id, { costKes: 1000, leadDays: 3 }));
  await throwsJob("a quote needs a price", () => submitQuote(stone.p.id, job.id, { costKes: 0, leadDays: 3 }));
  await submitQuote(stone.p.id, job.id, { costKes: 20000, leadDays: 7, note: "granite in stock" });
  await submitQuote(stone2.p.id, job.id, { costKes: 26000, leadDays: 4 });

  const q = await db.jobQuote.findMany({ where: { jobId: job.id } });
  const winner = q.find((x) => x.partnerId === stone.p.id)!;
  await throwsJob("a quote no one submitted cannot be accepted", async () => {
    const other = await db.jobQuote.create({ data: { jobId: job.id, partnerId: wood.p.id } });
    await acceptQuote(other.id);
  });
  await acceptQuote(winner.id);
  const assigned = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
  check("accepting assigns the partner at the quoted cost", assigned.status === "ASSIGNED" && assigned.partnerId === stone.p.id && assigned.agreedCostKes === 20000, assigned);
  check("the other bidder is declined", (await db.jobQuote.findUniqueOrThrow({ where: { id: q.find((x) => x.partnerId === stone2.p.id)!.id } })).status === "DECLINED");
  check("the job cannot be assigned twice", await acceptQuote(q.find((x) => x.partnerId === stone2.p.id)!.id).then(() => false, (e) => e instanceof JobError));
  check("order is with a partner", (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status === "SENT_TO_SUPPLIER");
  check("the losing partner can no longer see the job", (await jobForPartner(stone2.p.id, job.id)) === null);
  check("the winning partner still sees it", !!(await jobForPartner(stone.p.id, job.id)));

  await throwsJob("another partner cannot start my job", () => startProduction(stone2.p.id, job.id));
  await throwsJob("cannot ship before making", () => shipJob(stone.p.id, job.id, { trackingNote: "x" }, stone.user.id));
  await startProduction(stone.p.id, job.id);
  check("order is in production", (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status === "IN_PRODUCTION");
  await throwsJob("photo must be an image", () => submitProof(stone.p.id, job.id, { fileName: "x.pdf", mimeType: "application/pdf", bytes: Buffer.from("x") }, stone.user.id));
  await throwsJob("an SVG cannot pass as a photo", () => submitProof(stone.p.id, job.id, { fileName: "x.svg", mimeType: "image/svg+xml", bytes: Buffer.from("<svg onload=alert(1)/>") }, stone.user.id));
  await submitProof(stone.p.id, job.id, photo, stone.user.id);
  await throwsJob("cannot ship before the photo is approved", () => shipJob(stone.p.id, job.id, { trackingNote: "x" }, stone.user.id));
  await rejectProof(job.id, "QR is too small");
  const rej = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
  check("rejected photo sends it back to production with the reason", rej.status === "IN_PRODUCTION" && rej.rejectionNote === "QR is too small", rej);
  await submitProof(stone.p.id, job.id, photo, stone.user.id);
  await approveProof(job.id);
  await throwsJob("shipping needs tracking or a receipt", () => shipJob(stone.p.id, job.id, { trackingNote: "" }, stone.user.id));
  await shipJob(stone.p.id, job.id, { trackingNote: "G4S waybill 123" }, stone.user.id);
  check("via-us product: order is NOT shipped to the customer yet", (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status === "IN_PRODUCTION");
  await dispatchToCustomer(orderId, "Sendy 456");
  check("after our check, the order ships", (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status === "SHIPPED");
  await throwsJob("no payout before delivery", () => recordPayout(job.id, "MPESA123"));
  await markDelivered(orderId);
  check("delivered", (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status === "DELIVERED");
  await recordPayout(job.id, "MPESA123");
  check("partner payout recorded", !!(await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).paidOutAt);
  await throwsJob("cannot pay out twice", () => recordPayout(job.id, "MPESA124"));
  check("files kept: two finished photos", (await db.jobFile.count({ where: { jobId: job.id, kind: "finished_photo" } })) === 2);

  // ---- direct-ship product (tile plaque) ---------------------------------------------
  const o2 = await paidOrder("tile-plaque-qr", "tile");
  const j2 = (await db.productionJob.findMany({ where: { orderItem: { orderId: o2 } } }))[0]!;
  const tile = await partner("TileCo", ["tile_printing"]);
  await requestQuotes(j2.id, [tile.p.id]);
  await submitQuote(tile.p.id, j2.id, { costKes: 9000, leadDays: 5 });
  await acceptQuote((await db.jobQuote.findFirstOrThrow({ where: { jobId: j2.id } })).id);
  await startProduction(tile.p.id, j2.id);
  await submitProof(tile.p.id, j2.id, photo, tile.user.id);
  await approveProof(j2.id);
  await shipJob(tile.p.id, j2.id, { trackingNote: "Wells Fargo 789" }, tile.user.id);
  check("direct product: partner shipping ships the customer's order", (await db.order.findUniqueOrThrow({ where: { id: o2 } })).status === "SHIPPED");

  // ---- two stages in order ---------------------------------------------------------------
  await db.product.update({ where: { slug: "family-tree-poster" }, data: { skills: ["printing", "framing"] } });
  const o3 = await paidOrder("family-tree-poster", "poster");
  const stages = await db.productionJob.findMany({ where: { orderItem: { orderId: o3 } }, orderBy: { stage: "asc" } });
  check("two-stage product opens two jobs in order", stages.length === 2 && stages[0]!.skill === "printing" && stages[1]!.skill === "framing", stages);
  const printer = await partner("PrintCo", ["printing"]);
  const framer = await partner("FrameCo", ["framing"]);
  for (const [j, pt] of [[stages[0]!, printer], [stages[1]!, framer]] as const) {
    await requestQuotes(j.id, [pt.p.id]);
    await submitQuote(pt.p.id, j.id, { costKes: 3000, leadDays: 2 });
    await acceptQuote((await db.jobQuote.findFirstOrThrow({ where: { jobId: j.id } })).id);
  }
  await throwsJob("the framer cannot start before printing is shipped on", () => startProduction(framer.p.id, stages[1]!.id));
  await startProduction(printer.p.id, stages[0]!.id);
  await submitProof(printer.p.id, stages[0]!.id, photo, printer.user.id);
  await approveProof(stages[0]!.id);
  await shipJob(printer.p.id, stages[0]!.id, { trackingNote: "to framer" }, printer.user.id);
  check("first stage shipped on does not ship the customer's order", (await db.order.findUniqueOrThrow({ where: { id: o3 } })).status !== "SHIPPED");
  await startProduction(framer.p.id, stages[1]!.id);
  check("the framer can start once printing is shipped on", (await db.productionJob.findUniqueOrThrow({ where: { id: stages[1]!.id } })).status === "IN_PRODUCTION");

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
