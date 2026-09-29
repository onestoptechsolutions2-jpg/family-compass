"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  JobError, acceptQuote, approveProof, createJobsForOrder, dispatchToCustomer, markDelivered,
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

export async function acceptQuoteAction(quoteId: string) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await acceptQuote(quoteId);
    await writeAudit({ actorId: admin.id, action: "job.accept_quote", targetType: "quote", targetId: quoteId });
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

/** For products that come to us first: after our check, send to the customer. */
export async function dispatchAction(orderId: string, formData: FormData) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await dispatchToCustomer(orderId, String(formData.get("trackingNote") ?? ""));
    await writeAudit({ actorId: admin.id, action: "order.dispatch", targetType: "order", targetId: orderId });
  });
}

export async function deliveredAction(orderId: string) {
  const admin = await requirePlatformAdmin();
  await guarded(async () => {
    await markDelivered(orderId);
    await writeAudit({ actorId: admin.id, action: "order.delivered", targetType: "order", targetId: orderId });
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

export async function cancelOrder(orderId: string) {
  const admin = await requirePlatformAdmin();
  await db.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
  await db.productionJob.updateMany({ where: { orderItem: { orderId }, status: { notIn: ["DELIVERED"] } }, data: { status: "CANCELLED" } });
  await writeAudit({ actorId: admin.id, action: "order.cancel", targetType: "order", targetId: orderId });
  revalidatePath("/admin/orders");
}
