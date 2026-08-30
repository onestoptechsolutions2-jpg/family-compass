import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_DAYS = 30;

function cookieName(): string {
  return env.APP_URL.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/**
 * Create a database-backed Auth.js session for `userId` and set the session
 * cookie on the current response. Used by the WhatsApp one-time-link sign-in
 * (no OAuth / no email involved).
 */
export async function startDbSession(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);

  await db.session.create({ data: { sessionToken, userId, expires } });

  const jar = await cookies();
  jar.set(cookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.APP_URL.startsWith("https://"),
    expires,
  });
}
