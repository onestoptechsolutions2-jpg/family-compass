import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";

/** Create a single-use passwordless sign-in URL for a user. */
export async function mintLoginLink(
  userId: string,
  opts: { days?: number; purpose?: string } = {},
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await db.loginToken.create({
    data: {
      token,
      userId,
      purpose: opts.purpose ?? "login",
      expiresAt: new Date(Date.now() + (opts.days ?? 7) * 864e5),
    },
  });
  return `${await publicOrigin()}/api/auth/link/${token}`;
}

/** Validate + burn a login token. Returns the userId, or null. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const row = await db.loginToken.findUnique({ where: { token } });
  if (!row || row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.loginToken.update({ where: { token }, data: { usedAt: new Date() } });
  return row.userId;
}
