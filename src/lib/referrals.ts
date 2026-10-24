import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payments";
import { notifyUser } from "@/lib/notify";
import { randomToken } from "@/lib/slug";
import { chooseReferrer, codeStem, commissionKes, normaliseCode } from "@/lib/referral-rules";

export * from "@/lib/referral-rules";

/** The referrer behind a code, if there is one. */
export async function referrerByCode(raw: string | null | undefined) {
  const code = normaliseCode(raw);
  return code ? db.referrer.findUnique({ where: { code }, select: { id: true, userId: true, status: true, code: true, name: true } }) : null;
}

/** A fresh code for a new referrer, from their name. */
export async function uniqueCode(name: string): Promise<string> {
  const stem = codeStem(name);
  for (let i = 0; i < 20; i++) {
    const digits = String(100 + Math.floor(Math.random() * 900));
    const code = i < 10 ? `${stem}${digits}` : `${stem}${randomToken(4).toUpperCase()}`;
    const clean = normaliseCode(code);
    if (clean && !(await db.referrer.findUnique({ where: { code: clean }, select: { id: true } }))) return clean;
  }
  throw new Error("Could not make a referral code. Please try again.");
}

/** Who an order placed now is credited to, from a typed code or the link's cookie. */
export async function referrerForCheckout(customerUserId: string, typedCode: string | null, linkCode: string | null): Promise<string | null> {
  const [typed, fromLink] = await Promise.all([referrerByCode(typedCode), referrerByCode(linkCode)]);
  return chooseReferrer(typed, fromLink, customerUserId)?.id ?? null;
}

/**
 * The order's payment has cleared: record what its referrer earned. Safe to call twice (one
 * commission per order). The share is frozen now, so a later change to the rate never moves it.
 */
export async function recordCommission(orderId: string, paidKes: number): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, referrer: { select: { id: true, userId: true, status: true, percent: true } } },
  });
  const r = order?.referrer;
  if (!r || r.status !== "ACTIVE" || r.userId === order.userId) return;
  const percent = r.percent ?? (await getPaymentSettings()).referralPercent;
  const amountKes = commissionKes(paidKes, percent);
  if (amountKes <= 0) return;
  const made = await db.referralCommission.createMany({
    data: [{ referrerId: r.id, orderId, orderKes: paidKes, percent, amountKes }],
    skipDuplicates: true,
  });
  if (made.count > 0 && r.userId) {
    await notifyUser(r.userId, {
      kind: "referral.earned",
      title: "You earned a commission",
      body: `A family you sent placed an order. You earned KES ${amountKes.toLocaleString("en-KE")}; we will send it to your M-Pesa.`,
      linkPath: "/refer/dashboard",
      email: true,
    });
  }
}

/** An order was cancelled: what was not yet paid out is no longer owed. */
export async function cancelCommission(orderId: string): Promise<void> {
  await db.referralCommission.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED", note: "Order cancelled" } });
}
