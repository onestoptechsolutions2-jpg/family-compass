import { db } from "@/lib/db";
import { hasEmailProvider } from "@/lib/env";
import { sendBranded } from "@/lib/email";
import { mintToken } from "@/lib/login-token";
import { publicOrigin } from "@/lib/origin";

/** Email a link that confirms the address is theirs. It signs nobody in. Never throws. */
export async function sendVerifyEmail(userId: string, opts: { welcome?: boolean } = {}): Promise<boolean> {
  if (!hasEmailProvider) return false;
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, emailVerified: true } });
    if (!u?.email || u.emailVerified) return false;
    const token = await mintToken(userId, "verify", 7);
    const url = `${(await publicOrigin()).replace(/\/$/, "")}/api/auth/verify/${token}`;
    const first = u.name?.split(" ")[0];
    return await sendBranded(u.email, opts.welcome ? "Welcome to Family Compass: confirm your email" : "Confirm your email", {
      heading: opts.welcome ? "Welcome to Family Compass" : "Confirm your email",
      paragraphs: [
        `Hello${first ? ` ${first}` : ""},`,
        opts.welcome
          ? "Your account is ready. Confirm your email so we can send you your receipts and tell you when your piece is made, on its way and delivered."
          : "Confirm that this is your email address, so we can send you your receipts and order updates.",
      ],
      button: { label: "Confirm my email", url },
      footnote: "The link works for 7 days. If you did not create an account, you can ignore this email.",
    });
  } catch (err) {
    console.error("[verify-email] failed", err);
    return false;
  }
}
