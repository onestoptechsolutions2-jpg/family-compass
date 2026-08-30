import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { describeDevice, clientIp } from "@/lib/user-agent";

const SESSION_DAYS = 30;
const TOUCH_EVERY_MS = 60 * 60 * 1000; // refresh "last seen" at most hourly

export function sessionCookieName(): string {
  return env.APP_URL.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}
const cookieName = sessionCookieName;

/**
 * Create a database-backed Auth.js session for `userId` and set the session
 * cookie on the current response. Used by the WhatsApp one-time-link sign-in
 * (no OAuth / no email involved).
 */
export async function startDbSession(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);

  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
    ip = clientIp(h.get("x-forwarded-for")) ?? h.get("x-real-ip") ?? null;
  } catch {
    // headers() unavailable in some contexts — device details are best-effort
  }

  await db.session.create({
    data: {
      sessionToken,
      userId,
      expires,
      ip,
      userAgent,
      device: describeDevice(userAgent),
      lastSeenAt: new Date(),
    },
  });

  const jar = await cookies();
  jar.set(cookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.APP_URL.startsWith("https://"),
    expires,
  });
}

/**
 * Best-effort "this device was active" update for the current DB session.
 * Throttled to once an hour, and backfills device/ip/user-agent for sessions
 * created by the OAuth adapter (which doesn't record them). Never throws.
 */
export async function touchSession(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(cookieName())?.value;
    if (!token) return;

    const row = await db.session.findUnique({
      where: { sessionToken: token },
      select: { id: true, lastSeenAt: true, device: true },
    });
    if (!row) return;
    if (row.lastSeenAt && Date.now() - row.lastSeenAt.getTime() < TOUCH_EVERY_MS) return;

    let ua: string | null = null;
    let ip: string | null = null;
    try {
      const h = await headers();
      ua = h.get("user-agent")?.slice(0, 400) ?? null;
      ip = clientIp(h.get("x-forwarded-for")) ?? h.get("x-real-ip") ?? null;
    } catch {
      /* headers unavailable */
    }

    await db.session.update({
      where: { id: row.id },
      data: {
        lastSeenAt: new Date(),
        ...(row.device ? {} : { device: describeDevice(ua), userAgent: ua, ip }),
      },
    });
  } catch (err) {
    console.error("[session] touch failed", err);
  }
}
