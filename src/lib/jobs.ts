import { JobStatus, OrderStatus, PartnerStatus, QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { notifyPlatformAdmins, notifyUser } from "@/lib/notify";

/** What a partner can be good at. A product lists the skills it needs, in order. */
export const SKILLS: Record<string, string> = {
  stone_engraving: "Stone engraving",
  tile_printing: "Tile printing",
  wood_engraving: "Wood engraving",
  acrylic_metal: "Acrylic and metal",
  printing: "Printing (paper, canvas, banners)",
  framing: "Framing",
  binding: "Book binding",
  apparel: "Apparel and merchandise",
};
export const skillLabel = (k: string) => SKILLS[k] ?? k;

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  OPEN: "Needs a partner",
  QUOTING: "Waiting for quotes",
  ASSIGNED: "Assigned",
  IN_PRODUCTION: "In production",
  PROOF_SUBMITTED: "Photo submitted, needs approval",
  PROOF_APPROVED: "Approved, ready to ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** A later stage only starts once every earlier stage has been shipped on. */
const PAST_PRODUCTION: JobStatus[] = [JobStatus.SHIPPED, JobStatus.DELIVERED];

export class JobError extends Error {}

/** Photos only. An SVG or HTML "photo" could run script when an admin opens it. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
function checkPhoto(f: { mimeType: string; bytes: Buffer }) {
  if (!PHOTO_TYPES.includes(f.mimeType)) throw new JobError("Upload a photo (JPEG, PNG or WebP)");
  if (f.bytes.length > 10 * 1024 * 1024) throw new JobError("The photo is over 10 MB");
}

async function partnerMemberIds(partnerId: string): Promise<string[]> {
  const rows = await db.partnerMember.findMany({ where: { partnerId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/**
 * An order's status is worked out from all its items, never set by one job:
 * with several things in a basket, one can ship while another is still being made.
 */
export async function syncOrderStatus(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { jobs: { select: { status: true } } } } },
  });
  if (!order) return;
  const paid: OrderStatus[] = [
    OrderStatus.DEPOSIT_VERIFIED, OrderStatus.SENT_TO_SUPPLIER, OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED,
  ];
  if (!paid.includes(order.status)) return; // not yet paid, cancelled or delivered: nothing to derive
  const items = order.items;
  const jobs = items.flatMap((i) => i.jobs);
  let next: OrderStatus = OrderStatus.DEPOSIT_VERIFIED;
  if (items.length && items.every((i) => i.deliveredAt)) next = OrderStatus.DELIVERED;
  else if (items.length && items.every((i) => i.shippedAt)) next = OrderStatus.SHIPPED;
  else if (items.some((i) => i.shippedAt) || jobs.some((j) => IN_MAKING.includes(j.status))) next = OrderStatus.IN_PRODUCTION;
  else if (jobs.some((j) => j.status === JobStatus.ASSIGNED)) next = OrderStatus.SENT_TO_SUPPLIER;
  if (next !== order.status) await db.order.update({ where: { id: orderId }, data: { status: next } });
}

const IN_MAKING: JobStatus[] = [JobStatus.IN_PRODUCTION, JobStatus.PROOF_SUBMITTED, JobStatus.PROOF_APPROVED, JobStatus.SHIPPED];

/** Open one job per stage a product needs. Called once the order is paid; safe to call twice. */
export async function createJobsForOrder(orderId: string): Promise<number> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    include: { product: { select: { skills: true } } },
  });
  let made = 0;
  for (const item of items) {
    const skills = item.product.skills.length ? item.product.skills : ["printing"];
    for (const [i, skill] of skills.entries()) {
      const r = await db.productionJob.upsert({
        where: { orderItemId_stage: { orderItemId: item.id, stage: i + 1 } },
        create: { orderItemId: item.id, stage: i + 1, skill },
        update: {},
        select: { createdAt: true, updatedAt: true },
      });
      if (r.createdAt.getTime() === r.updatedAt.getTime()) made++;
    }
  }
  if (made) {
    await notifyPlatformAdmins({
      kind: "job.opened",
      title: "New order to assign",
      body: `${made} job${made === 1 ? "" : "s"} need a partner`,
      linkPath: "/admin/orders",
    });
  }
  return made;
}

/** Active partners with the skill the job needs, cheapest-known first is left to the caller. */
export async function eligiblePartners(jobId: string) {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, select: { skill: true } });
  return db.partner.findMany({
    where: { status: PartnerStatus.ACTIVE, skills: { has: job.skill } },
    orderBy: { name: "asc" },
  });
}

/** Ask chosen partners to quote. The admin chooses; the system only filters. */
export async function requestQuotes(jobId: string, partnerIds: string[]) {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== JobStatus.OPEN && job.status !== JobStatus.QUOTING) {
    throw new JobError("This job already has a partner");
  }
  const eligible = new Set((await eligiblePartners(jobId)).map((p) => p.id));
  const chosen = partnerIds.filter((id) => eligible.has(id));
  if (!chosen.length) throw new JobError("Choose at least one partner with this speciality");

  for (const partnerId of chosen) {
    await db.jobQuote.upsert({
      where: { jobId_partnerId: { jobId, partnerId } },
      create: { jobId, partnerId },
      update: {},
    });
    for (const uid of await partnerMemberIds(partnerId)) {
      await notifyUser(uid, {
        kind: "job.quote_requested",
        title: "New job to quote",
        body: skillLabel(job.skill),
        linkPath: `/partner/jobs/${jobId}`,
      });
    }
  }
  await db.productionJob.update({ where: { id: jobId }, data: { status: JobStatus.QUOTING } });
}

export async function submitQuote(
  partnerId: string,
  jobId: string,
  input: { costKes: number; leadDays: number; note?: string },
) {
  if (!Number.isInteger(input.costKes) || input.costKes <= 0) throw new JobError("Enter your price in whole KES");
  if (!Number.isInteger(input.leadDays) || input.leadDays <= 0) throw new JobError("Enter the days you need");
  const quote = await db.jobQuote.findUnique({
    where: { jobId_partnerId: { jobId, partnerId } },
    include: { job: true },
  });
  if (!quote) throw new JobError("You were not asked to quote this job");
  if (quote.job.status !== JobStatus.QUOTING) throw new JobError("This job is no longer taking quotes");
  await db.jobQuote.update({
    where: { id: quote.id },
    data: { status: QuoteStatus.SUBMITTED, costKes: input.costKes, leadDays: input.leadDays, note: input.note?.slice(0, 300) || null },
  });
  await notifyPlatformAdmins({
    kind: "job.quote_submitted",
    title: "Quote received",
    body: `KES ${input.costKes.toLocaleString()} · ${input.leadDays} days`,
    linkPath: "/admin/orders",
  });
}

/** Choose a quote: that partner is assigned, the others are told no. */
/**
 * Accept a partner's quote. Refuses a price that leaves nothing from what the customer paid for
 * the item (counting the other stages already agreed), unless the admin says they mean it.
 */
export async function acceptQuote(quoteId: string, opts: { allowLoss?: boolean } = {}) {
  const quote = await db.jobQuote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { job: { include: { orderItem: true } } },
  });
  if (quote.status !== QuoteStatus.SUBMITTED || quote.costKes == null || quote.leadDays == null) {
    throw new JobError("Only a submitted quote can be accepted");
  }
  const job = quote.job;
  if (job.status !== JobStatus.QUOTING) throw new JobError("This job already has a partner");

  const revenue = job.orderItem.unitPriceKes * job.orderItem.quantity;
  const others = await db.productionJob.findMany({
    where: { orderItemId: job.orderItemId, id: { not: job.id }, status: { not: JobStatus.CANCELLED } },
    select: { agreedCostKes: true },
  });
  const totalCost = quote.costKes + others.reduce((n, o) => n + (o.agreedCostKes ?? 0), 0);
  if (totalCost >= revenue && !opts.allowLoss) {
    throw new JobError(
      `This quote takes the cost of this item to KES ${totalCost.toLocaleString("en-KE")}, and the customer paid KES ${revenue.toLocaleString("en-KE")} for it, so nothing is left. Ask for a lower quote, or tick "accept at a loss" if you mean it.`,
    );
  }

  const due = new Date();
  due.setDate(due.getDate() + quote.leadDays);
  await db.$transaction([
    db.jobQuote.update({ where: { id: quote.id }, data: { status: QuoteStatus.ACCEPTED } }),
    db.jobQuote.updateMany({
      where: { jobId: job.id, id: { not: quote.id }, status: { in: [QuoteStatus.REQUESTED, QuoteStatus.SUBMITTED] } },
      data: { status: QuoteStatus.DECLINED },
    }),
    db.productionJob.update({
      where: { id: job.id },
      data: { status: JobStatus.ASSIGNED, partnerId: quote.partnerId, agreedCostKes: quote.costKes, leadDays: quote.leadDays, dueAt: due },
    }),
  ]);
  const partner = await db.partner.findUniqueOrThrow({ where: { id: quote.partnerId }, select: { name: true } });
  // keep the older summary fields on the order item in step
  await db.orderItem.update({
    where: { id: job.orderItemId },
    data: { supplierName: partner.name, supplierCostKes: quote.costKes, sentToSupplierAt: new Date() },
  });
  await syncOrderStatus(job.orderItem.orderId);
  for (const uid of await partnerMemberIds(quote.partnerId)) {
    await notifyUser(uid, {
      kind: "job.assigned",
      title: "You got the job",
      body: `${skillLabel(job.skill)} · due ${due.toISOString().slice(0, 10)}`,
      linkPath: `/partner/jobs/${job.id}`,
    });
  }
}

async function ownJob(partnerId: string, jobId: string) {
  const job = await db.productionJob.findUnique({ where: { id: jobId }, include: { orderItem: true } });
  if (!job || job.partnerId !== partnerId) throw new JobError("This is not your job");
  return job;
}

export async function startProduction(partnerId: string, jobId: string) {
  const job = await ownJob(partnerId, jobId);
  if (job.status !== JobStatus.ASSIGNED) throw new JobError("This job is not waiting to start");
  const earlier = await db.productionJob.count({
    where: { orderItemId: job.orderItemId, stage: { lt: job.stage }, status: { notIn: PAST_PRODUCTION } },
  });
  if (earlier) throw new JobError("An earlier stage of this order is not finished yet");
  await db.productionJob.update({ where: { id: jobId }, data: { status: JobStatus.IN_PRODUCTION } });
  await syncOrderStatus(job.orderItem.orderId);
}

/** The partner's photo of the finished piece, for us to check before it ships. */
export async function submitProof(
  partnerId: string,
  jobId: string,
  file: { fileName: string; mimeType: string; bytes: Buffer },
  uploadedById: string,
) {
  const job = await ownJob(partnerId, jobId);
  if (job.status !== JobStatus.IN_PRODUCTION) throw new JobError("Start production before sending the photo");
  checkPhoto(file);
  await db.jobFile.create({
    data: { jobId, kind: "finished_photo", fileName: file.fileName.slice(0, 120), mimeType: file.mimeType, byteSize: file.bytes.length, bytes: new Uint8Array(file.bytes), uploadedById },
  });
  await db.productionJob.update({ where: { id: jobId }, data: { status: JobStatus.PROOF_SUBMITTED, rejectionNote: null } });
  await notifyPlatformAdmins({
    kind: "job.proof_submitted",
    title: "Finished piece to check",
    body: skillLabel(job.skill),
    linkPath: "/admin/orders",
  });
}

export async function approveProof(jobId: string) {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== JobStatus.PROOF_SUBMITTED) throw new JobError("There is no photo waiting for approval");
  await db.productionJob.update({ where: { id: jobId }, data: { status: JobStatus.PROOF_APPROVED } });
  if (job.partnerId) {
    for (const uid of await partnerMemberIds(job.partnerId)) {
      await notifyUser(uid, { kind: "job.proof_approved", title: "Approved: you can ship", body: skillLabel(job.skill), linkPath: `/partner/jobs/${jobId}` });
    }
  }
}

export async function rejectProof(jobId: string, reason: string) {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== JobStatus.PROOF_SUBMITTED) throw new JobError("There is no photo waiting for approval");
  if (!reason.trim()) throw new JobError("Say what needs fixing");
  await db.productionJob.update({
    where: { id: jobId },
    data: { status: JobStatus.IN_PRODUCTION, rejectionNote: reason.trim().slice(0, 300) },
  });
  if (job.partnerId) {
    for (const uid of await partnerMemberIds(job.partnerId)) {
      await notifyUser(uid, { kind: "job.proof_rejected", title: "Photo not approved", body: reason.slice(0, 200), linkPath: `/partner/jobs/${jobId}` });
    }
  }
}

/**
 * The partner has dispatched. For a product that ships direct this is the
 * customer's order shipping; for one that comes to us first it is on its way
 * to us, and the order is shipped on later with dispatchToCustomer.
 */
export async function shipJob(
  partnerId: string,
  jobId: string,
  input: { trackingNote: string; proof?: { fileName: string; mimeType: string; bytes: Buffer } },
  uploadedById: string,
) {
  const job = await ownJob(partnerId, jobId);
  if (job.status !== JobStatus.PROOF_APPROVED) throw new JobError("The finished piece has not been approved yet");
  const tracking = input.trackingNote.trim();
  if (!tracking && !input.proof) throw new JobError("Add tracking details or a photo of the dispatch receipt");
  if (input.proof) {
    checkPhoto(input.proof);
    await db.jobFile.create({
      data: { jobId, kind: "dispatch_proof", fileName: input.proof.fileName.slice(0, 120), mimeType: input.proof.mimeType, byteSize: input.proof.bytes.length, bytes: new Uint8Array(input.proof.bytes), uploadedById },
    });
  }
  await db.productionJob.update({ where: { id: jobId }, data: { status: JobStatus.SHIPPED, trackingNote: tracking.slice(0, 300) || null } });

  const item = await db.orderItem.findUniqueOrThrow({ where: { id: job.orderItemId }, include: { product: { select: { shipVia: true } } } });
  const laterStages = await db.productionJob.count({ where: { orderItemId: item.id, stage: { gt: job.stage } } });
  // A product that ships direct is on its way to the customer once its last stage is dispatched.
  if (item.product.shipVia === "direct" && !laterStages) {
    await db.orderItem.update({ where: { id: item.id }, data: { shippedAt: new Date(), customerTracking: tracking.slice(0, 300) || null } });
  }
  await syncOrderStatus(item.orderId);
  await notifyPlatformAdmins({
    kind: "job.shipped",
    title: item.product.shipVia === "direct" ? "Shipped to the customer" : "On its way to us",
    body: tracking || "Dispatch proof uploaded",
    linkPath: "/admin/orders",
  });
}

/** For an item that comes to us first: after our check, send it to the customer. */
export async function dispatchItem(itemId: string, trackingNote: string) {
  const item = await db.orderItem.findUniqueOrThrow({ where: { id: itemId }, include: { jobs: true } });
  if (item.shippedAt) throw new JobError("This item has already been sent");
  if (!item.jobs.length || item.jobs.some((j) => j.status !== JobStatus.SHIPPED && j.status !== JobStatus.DELIVERED)) {
    throw new JobError("Every stage must be shipped to us first");
  }
  await db.orderItem.update({ where: { id: itemId }, data: { shippedAt: new Date(), customerTracking: trackingNote.slice(0, 300) || null } });
  await syncOrderStatus(item.orderId);
  await notifyItemCustomer(itemId, "Your order is on its way", trackingNote);
}

/** Every item on the order that has come to us and passed our check. */
export async function dispatchToCustomer(orderId: string, trackingNote: string) {
  const items = await db.orderItem.findMany({ where: { orderId, shippedAt: null }, include: { jobs: true } });
  const ready = items.filter((i) => i.jobs.length && i.jobs.every((j) => j.status === JobStatus.SHIPPED || j.status === JobStatus.DELIVERED));
  if (!ready.length) throw new JobError("Nothing has arrived and passed the check yet");
  for (const i of ready) await dispatchItem(i.id, trackingNote);
}

export async function markItemDelivered(itemId: string) {
  const item = await db.orderItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.shippedAt) throw new JobError("Only a shipped item can be marked delivered");
  if (item.deliveredAt) throw new JobError("Already delivered");
  await db.orderItem.update({ where: { id: itemId }, data: { deliveredAt: new Date() } });
  await db.productionJob.updateMany({ where: { orderItemId: itemId, status: JobStatus.SHIPPED }, data: { status: JobStatus.DELIVERED } });
  await syncOrderStatus(item.orderId);
  await notifyItemCustomer(itemId, "Your order was delivered");
}

/** Every shipped item on the order. */
export async function markDelivered(orderId: string) {
  const items = await db.orderItem.findMany({ where: { orderId, shippedAt: { not: null }, deliveredAt: null } });
  if (!items.length) throw new JobError("Only a shipped order can be marked delivered");
  for (const i of items) await markItemDelivered(i.id);
}

/** Tell the customer, in the app, about their item. */
async function notifyItemCustomer(itemId: string, title: string, body?: string) {
  const item = await db.orderItem.findUnique({ where: { id: itemId }, include: { order: { select: { userId: true } }, product: { select: { name: true } } } });
  if (!item?.order.userId) return;
  await notifyUser(item.order.userId, { kind: "order.update", title, body: body ? `${item.product.name} · ${body}` : item.product.name, linkPath: "/orders", email: true });
}

/** Record that we paid the partner. Only after delivery. */
export async function recordPayout(jobId: string, reference: string) {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== JobStatus.DELIVERED) throw new JobError("Pay the partner after delivery");
  if (job.paidOutAt) throw new JobError("Already paid out");
  if (!reference.trim()) throw new JobError("Enter the payment reference");
  await db.productionJob.update({ where: { id: jobId }, data: { paidOutAt: new Date(), payoutRef: reference.trim().slice(0, 80) } });
}

/** A partner sees a job only while they can still quote for it, or once they have won it. */
export async function jobForPartner(partnerId: string, jobId: string) {
  const job = await db.productionJob.findUnique({
    where: { id: jobId },
    include: {
      quotes: { where: { partnerId, status: { in: [QuoteStatus.REQUESTED, QuoteStatus.SUBMITTED, QuoteStatus.ACCEPTED] } } },
      orderItem: { include: { product: true, order: true } },
      files: { select: { id: true, kind: true, fileName: true, createdAt: true } },
    },
  });
  if (!job) return null;
  if (job.partnerId !== partnerId && job.quotes.length === 0) return null;
  return job;
}
