import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, bootstrapAdmin } from "./seed-lib";

const db = new PrismaClient();

async function main() {
  await seedPaymentSettings(db);
  await bootstrapAdmin(db);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
