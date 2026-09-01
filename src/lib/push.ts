import webpush from "web-push";

import { db } from "@/lib/db";
import { env, hasWebPush, vapidSubject } from "@/lib/env";

let configured = false;
function ensureConfigured(): boolean {
  if (!hasWebPush) return false;
  if (!configured) {
    webpush.setVapidDetails(vapidSubject(), env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

/** Notification categories a user can mute (the noun before the dot). */
export const NOTIFY_GROUPS: { key: string; label: string }[] = [
  { key: "person", label: "Life events (births, deaths, weddings)" },
  { key: "memorial", label: "Memorials & tributes" },
  { key: "claim", label: "Profile claims" },
  { key: "friend", label: "Friend connections" },
  { key: "anniversary", label: "Anniversary reminders" },
  { key: "chama", label: "Welfare / chama" },
  { key: "payment", label: "Payments" },
  { key: "invitation", label: "Invitations" },
  { key: "system", label: "System alerts" },
];

export type NotifyPrefs = { push?: boolean; muted: string[] };

/** Parse the JSON blob on User.notifyPrefs into a safe shape. */
export function parsePrefs(raw: unknown): NotifyPrefs {
  if (!raw || typeof raw !== "object") return { muted: [] };
  const o = raw as Record<string, unknown>;
  return {
    push: o.push === undefined ? undefined : !!o.push,
    muted: Array.isArray(o.muted) ? o.muted.filter((x): x is string => typeof x === "string") : [],
  };
}

/** The category a notification belongs to (the noun before the dot). */
export function notifyGroup(kind: string): string {
  return kind.split(".")[0] || "other";
}

/**
 * Push one notification to every device a user has subscribed. Best-effort:
 * never throws, prunes dead subscriptions (404/410), and respects the user's
 * prefs (push off, or this category muted).
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string | null; url?: string | null; kind?: string },
): Promise<void> {
  try {
    if (!ensureConfigured()) return;

    const user = await db.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
    const prefs = parsePrefs(user?.notifyPrefs);
    if (prefs.push === false) return;
    if (payload.kind && prefs.muted.includes(notifyGroup(payload.kind))) return;

    const subs = await db.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      url: payload.url ?? "/notifications",
      tag: payload.kind ?? undefined,
    });

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 24 },
          );
          await db.pushSubscription
            .update({ where: { id: s.id }, data: { lastOkAt: new Date() } })
            .catch(() => {});
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] sendPushToUser failed", err);
  }
}
