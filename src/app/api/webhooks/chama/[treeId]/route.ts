import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { verifyChamaWebhook } from "@/lib/chama-api";
import { notifyTreeManagers } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { emitTreeEvent } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/**
 * Inbound webhooks from a linked external Chama group. Signature is
 * HMAC-SHA256 hex of the raw body in `X-Chama-Signature`, keyed by the secret
 * we generated when the group was linked.
 */
export async function POST(req: Request, { params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const raw = await req.text();

  const link = await db.chamaLink.findUnique({
    where: { treeId },
    select: { webhookSecret: true, groupName: true },
  });
  if (!link?.webhookSecret) {
    return NextResponse.json({ error: "no link" }, { status: 404 });
  }
  if (!verifyChamaWebhook(raw, req.headers.get("x-chama-signature"), link.webhookSecret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: { event?: string; data?: Record<string, unknown> } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const event = String(body.event ?? "");
  const data = body.data ?? {};

  const summary =
    event === "contribution.recorded"
      ? `Chama: ${data.type ?? "contribution"} of ${data.amount ?? "?"} recorded on ${link.groupName ?? "the group"}`
      : event === "member.joined"
        ? `Chama: ${data.name ?? "a member"} joined ${link.groupName ?? "the group"}`
        : event === "mgr.slot.paid"
          ? `Chama: merry-go-round payout of ${data.payoutAmount ?? "?"} on ${link.groupName ?? "the group"}`
          : `Chama event: ${event}`;

  await logActivity({
    treeId,
    verb: "updated",
    objectType: "chama",
    objectId: treeId,
    summary,
  }).catch(() => {});

  if (event === "contribution.recorded" || event === "member.joined") {
    await notifyTreeManagers(treeId, {
      kind: "chama.external",
      title: "Chama group update",
      body: summary,
      linkPath: `/trees/${treeId}/chama`,
    }).catch(() => {});
  }

  await emitTreeEvent(treeId, "chama.external_event", { source: event, data }).catch(() => {});
  await db.chamaLink.update({ where: { treeId }, data: { lastSyncedAt: new Date() } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
