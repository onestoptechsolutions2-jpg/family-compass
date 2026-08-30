import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Global payment settings — a single row keyed by scope = "global".
  // The platform owner edits Till / Store details from /admin/settings.
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

  console.log("Seed complete: PaymentSettings(global) ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
