import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

/** Best-effort public origin. `docker exec` shells (Coolify terminal) don't
 *  inherit the compose `environment:` block, so also read PID 1's env. */
function resolveOrigin(): string {
  const fromEnv = (e: NodeJS.ProcessEnv) =>
    e.APP_URL ||
    e.AUTH_URL ||
    e.NEXTAUTH_URL ||
    e.COOLIFY_URL ||
    (e.COOLIFY_FQDN ? `https://${e.COOLIFY_FQDN.split(",")[0]!.trim()}` : "");

  let origin = fromEnv(process.env);
  if (!origin) {
    try {
      const pid1 = Object.fromEntries(
        readFileSync("/proc/1/environ", "utf8")
          .split("\0")
          .filter(Boolean)
          .map((kv) => {
            const i = kv.indexOf("=");
            return [kv.slice(0, i), kv.slice(i + 1)];
          }),
      ) as NodeJS.ProcessEnv;
      origin = fromEnv(pid1);
    } catch {
      /* not linux / no /proc */
    }
  }
  return (origin || "https://YOUR-DOMAIN").replace(/\/$/, "");
}

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

  const base = resolveOrigin();
  const path = `/api/auth/link/${token}`;
  console.log("\n============================================================");
  console.log(`SUPER-ADMIN SIGN-IN LINK for ${email}`);
  console.log("(single use, valid 7 days — open it in a browser):");
  console.log(`  ${base}${path}`);
  if (base === "https://YOUR-DOMAIN") {
    console.log("  (host unknown — replace YOUR-DOMAIN with your real domain)");
  }
  console.log("============================================================\n");
}
