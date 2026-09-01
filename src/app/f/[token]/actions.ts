"use server";

import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/rbac";
import { resolveOrCreateWaUser } from "@/lib/claims";
import { startDbSession } from "@/lib/session";
import { acceptFriendInvite, type AcceptFriendResult } from "@/lib/friends";
import { isValidPhone } from "@/lib/wa";
import { logActivity } from "@/lib/activity";
import { emitTreeEvent } from "@/lib/webhooks";
import { notifyUser } from "@/lib/notify";
import { db } from "@/lib/db";

async function finish(res: AcceptFriendResult): Promise<never> {
  await logActivity({
    treeId: res.fromTreeId,
    verb: "connected",
    objectType: "relation",
    objectId: res.linkId,
    summary: "a friend accepted an invite and connected their tree",
  });
  await emitTreeEvent(res.fromTreeId, "friend.linked", {
    linkId: res.linkId,
    friendTreeId: res.friendTreeId,
  });
  const inv = await db.friendInvite
    .findFirst({ where: { linkId: res.linkId }, select: { inviterUserId: true, inviteeName: true } })
    .catch(() => null);
  if (inv) {
    await notifyUser(inv.inviterUserId, {
      kind: "friend.linked",
      title: "A friend connected",
      body: `${inv.inviteeName} accepted your invite and started their own tree.`,
      linkPath: `/trees/${res.fromTreeId}`,
    });
  }
  redirect(`/trees/${res.friendTreeId}/people/${res.friendPersonId}?welcome=1`);
}

/** Already signed in — connect using the current account. */
export async function connectAsMe(token: string) {
  const me = await getSessionUser();
  if (!me) redirect(`/f/${token}?err=signin`);
  let res: AcceptFriendResult;
  try {
    res = await acceptFriendInvite(token, me!.id);
  } catch (e) {
    redirect(`/f/${token}?err=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
  await finish(res!);
}

/** Not signed in — create a WhatsApp account and connect. Existing numbers are
 *  bounced to normal sign-in so nobody can grab someone else's account. */
export async function connectAsNew(token: string, formData: FormData) {
  if (await getSessionUser()) {
    await connectAsMe(token);
    return;
  }
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (name.length < 2 || !isValidPhone(phone)) redirect(`/f/${token}?err=form`);

  const u = await resolveOrCreateWaUser(phone, name);
  if (!u.created) redirect(`/f/${token}?err=exists`);

  await startDbSession(u.id);
  let res: AcceptFriendResult;
  try {
    res = await acceptFriendInvite(token, u.id);
  } catch (e) {
    redirect(`/f/${token}?err=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
  await finish(res!);
}
