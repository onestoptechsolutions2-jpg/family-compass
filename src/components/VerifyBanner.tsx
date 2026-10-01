import { db } from "@/lib/db";
import { hasEmailProvider } from "@/lib/env";
import { resendVerifyEmail } from "@/app/shop/verify-actions";

/** Asks a signed-in shopper to confirm their email, until they have. Says nothing when email is not set up. */
export async function VerifyBanner({ userId, sent, confirmed }: { userId: string; sent?: boolean; confirmed?: boolean }) {
  if (confirmed) {
    return <p role="status" className="mb-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>Thank you. Your email is confirmed.</p>;
  }
  if (!hasEmailProvider) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true, email: true } });
  if (!u || u.emailVerified) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <span className="flex-1">
        {sent ? `We sent a link to ${u.email}. Open it to confirm.` : `Confirm your email (${u.email}) so we can send your receipts and order updates.`}
      </span>
      {!sent && (
        <form action={resendVerifyEmail}>
          <button className="rounded-md border px-3 py-1.5 font-medium" style={{ borderColor: "var(--border)" }}>Send me the link</button>
        </form>
      )}
    </div>
  );
}
