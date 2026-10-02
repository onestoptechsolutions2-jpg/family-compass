"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { recordRefund, refundableOn } from "@/lib/refunds";
import { wholeKes } from "@/lib/payments/verification";
import { writeAudit } from "@/lib/audit";
import {
  JobError, acceptQuote, approveProof, createJobsForOrder, dispatchItem, markItemDelivered,
  recordPayout, rejectProof, requestQuotes,
} from "@/lib/jobs";

/** A rule we enforce becomes a message on the same page, not an error screen. */
async function guarded(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof JobError) redirect(`/admin/orders?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/admin/orders");
}

export async function requestQuotesAction(jobId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await requestQuotes(jobId, formData.getAll("partnerIds").map(String));
    await writeAudit({ actorId: admin.id, action: "job.request_quotes", targetType: "job", targetId: jobId });
  });
}

export async function acceptQuoteAction(quoteId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const allowLoss = formData.get("allowLoss") === "on";
  await guarded(async () => {
    await acceptQuote(quoteId, { allowLoss });
    await writeAudit({ actorId: admin.id, action: "job.accept_quote", targetType: "quote", targetId: quoteId, meta: { allowLoss } });
  });
}

export async function approveProofAction(jobId: string) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await approveProof(jobId);
    await writeAudit({ actorId: admin.id, action: "job.approve_proof", targetType: "job", targetId: jobId });
  });
}

export async function rejectProofAction(jobId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await rejectProof(jobId, String(formData.get("reason") ?? ""));
    await writeAudit({ actorId: admin.id, action: "job.reject_proof", targetType: "job", targetId: jobId });
  });
}

/** For an item that comes to us first: after our check, send it to the customer. */
export async function dispatchAction(itemId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await dispatchItem(itemId, String(formData.get("trackingNote") ?? ""));
    await writeAudit({ actorId: admin.id, action: "item.dispatch", targetType: "orderItem", targetId: itemId });
  });
}

export async function deliveredAction(itemId: string) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await markItemDelivered(itemId);
    await writeAudit({ actorId: admin.id, action: "item.delivered", targetType: "orderItem", targetId: itemId });
  });
}

export async function payoutAction(jobId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await recordPayout(jobId, String(formData.get("reference") ?? ""));
    await writeAudit({ actorId: admin.id, action: "job.payout", targetType: "job", targetId: jobId });
  });
}

/** For an order paid before jobs existed: open its production jobs now. */
export async function openJobsAction(orderId: string) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await createJobsForOrder(orderId);
    await writeAudit({ actorId: admin.id, action: "order.open_jobs", targetType: "order", targetId: orderId });
  });
}

/**
 * Cancel an order. If the customer has paid, the refund (what you are giving back) must be stated, even
 * if it is nothing, and a refund short of everything needs the reason. The money itself goes back by
 * M-Pesa from your own phone; this is the record, so cash never leaves without a trace.
 */
export async function cancelOrder(orderId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  const { paidKes, roomKes } = await refundableOn(orderId);
  const note = String(formData.get("refundNote") ?? "").trim().slice(0, 300);
  let refunded = 0;
  if (paidKes > 0) {
    const asked = wholeKes(formData.get("refundKes"));
    if (asked === null) redirect(`/admin/orders?error=${encodeURIComponent("The customer has paid. Enter the amount you are refunding (0 if none).")}`);
    if (asked! > roomKes) redirect(`/admin/orders?error=${encodeURIComponent(`Only KES ${roomKes.toLocaleString("en-KE")} can still be refunded on this order.`)}`);
    if (asked! < roomKes && !note) redirect(`/admin/orders?error=${encodeURIComponent("You are refunding less than the customer paid. Say why, so it can be explained to them.")}`);
    refunded = asked!;
    if (refunded > 0) await recordRefund(orderId, refunded, note || "Order cancelled");
  }
  await db.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
  await db.productionJob.updateMany({ where: { orderItem: { orderId }, status: { notIn: ["DELIVERED"] } }, data: { status: "CANCELLED" } });
  await writeAudit({ actorId: admin.id, action: "order.cancel", targetType: "order", targetId: orderId, meta: { paidKes, refundedKes: refunded, note } });
  revalidatePath("/admin/orders");
  revalidatePath("/admin/money");
}
