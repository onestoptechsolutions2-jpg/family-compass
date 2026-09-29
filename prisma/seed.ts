import { PrismaClient } from "@prisma/client";

import {
  seedPaymentSettings,
  seedProducts,
  seedKenyaLocations,
  seedReferenceClans,
  bootstrapAdmin,
} from "./seed-lib";

const db = new PrismaClient();

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);
  await seedKenyaLocations(db);
  await seedReferenceClans(db);
  await bootstrapAdmin(db);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
