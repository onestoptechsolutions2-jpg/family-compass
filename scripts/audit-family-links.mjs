// Phase 0 audit (docs/commerce/PLAN.md): how many users would break the rule
// "every user is one Person with one primary family". Read-only.
//   node --env-file-if-exists=.env scripts/audit-family-links.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const [total, noPerson, noTree, multiOwner] = await Promise.all([
  db.user.count(),
  db.user.count({ where: { personId: null } }),
  db.user.count({ where: { primaryTreeId: null } }),
  db.$queryRaw`SELECT COUNT(*)::int AS n FROM (SELECT "userId" FROM "Membership" GROUP BY "userId" HAVING COUNT(*) > 1) x`,
]);
console.log({ total, noPerson, noPrimaryTree: noTree, usersWithSeveralMemberships: multiOwner[0].n });
await db.$disconnect();
