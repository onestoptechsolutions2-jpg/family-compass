import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const NANO = "23456789abcdefghijkmnpqrstuvwxyz";
const rand = (n: number) => Array.from(randomBytes(n), (b) => NANO[b % NANO.length]).join("");

export async function seedPaymentSettings(db: PrismaClient): Promise<void> {
  await db.paymentSettings.upsert({
    where: { scope: "global" },
    update: {},
    create: {
      scope: "global",
      provider: "manual_mpesa",
      currency: "KES",
      defaultPriceKes: 750,
      verificationMode: "MANUAL",
      businessName: "Family Compass",
      instructions:
        "Send the exact amount to our M-Pesa Till, then paste the M-Pesa confirmation code below. Payments are verified within a few hours.",
    },
  });
  console.log("Seed: PaymentSettings(global) ready.");
}

/** Bootstrap a platform super-admin and print a one-time sign-in link. */
export async function bootstrapAdmin(db: PrismaClient): Promise<void> {
  const email = (
    process.env.SUPERADMIN_EMAIL ||
    (process.env.ADMIN_EMAILS || "").split(",")[0] ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    console.log("Seed: no SUPERADMIN_EMAIL / ADMIN_EMAILS set — skipping admin bootstrap.");
    return;
  }
  const name = process.env.SUPERADMIN_NAME?.trim() || "Super Admin";

  const user = await db.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true },
    create: { email, name, isPlatformAdmin: true },
  });

  const ownerMembership = await db.membership.findFirst({
    where: { userId: user.id, role: "OWNER" },
    select: { id: true },
  });
  if (!ownerMembership) {
    await db.workspace.create({
      data: {
        name: `${name}'s Family`,
        slug: `admin-${rand(6)}`,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }

  const token = randomBytes(24).toString("hex");
  await db.loginToken.create({
    data: {
      token,
      userId: user.id,
      purpose: "bootstrap",
      expiresAt: new Date(Date.now() + 7 * 864e5),
    },
  });

  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log("\n============================================================");
  console.log(`SUPER-ADMIN SIGN-IN LINK for ${email}`);
  console.log("(single use, valid 7 days — open it in a browser):");
  console.log(`  ${base}/api/auth/link/${token}`);
  console.log("============================================================\n");
}
