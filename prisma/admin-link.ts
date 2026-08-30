import { PrismaClient } from "@prisma/client";

import { bootstrapAdmin } from "./seed-lib";

/**
 * Print a fresh one-time super-admin sign-in link without touching anything
 * else. Uses SUPERADMIN_EMAIL, or the first entry of ADMIN_EMAILS.
 *
 *   npm run admin:link
 */
const db = new PrismaClient();

bootstrapAdmin(db)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
