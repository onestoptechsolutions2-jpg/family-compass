import { db } from "@/lib/db";
import { env, isAdminEmail } from "@/lib/env";

/**
 * Gate for who is allowed to sign in. There is no open registration form —
 * a first successful sign-in creates the account, but only for:
 *   - configured admins (ADMIN_EMAILS)
 *   - people who already have an account
 *   - people with a pending, unexpired invitation
 *   - addresses on ALLOWED_SIGNUP_EMAILS / ALLOWED_SIGNUP_DOMAINS
 * ...unless OPEN_SIGNUP=true, which lets anyone in.
 */
export async function canSignIn(rawEmail: string | null | undefined): Promise<boolean> {
  if (env.OPEN_SIGNUP) return true;

  const email = rawEmail?.trim().toLowerCase();
  if (!email) return false;

  if (isAdminEmail(email)) return true;

  if (env.ALLOWED_SIGNUP_EMAILS.includes(email)) return true;

  const domain = email.split("@")[1] ?? "";
  if (domain && env.ALLOWED_SIGNUP_DOMAINS.includes(domain)) return true;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return true;

  const invite = await db.invitation.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(invite);
}
