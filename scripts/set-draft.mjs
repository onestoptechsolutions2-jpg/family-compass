// Fill a draft order's wizard answers, for driving the wizard by hand:
//   node scripts/set-draft.mjs <guestToken>
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const token = process.argv[2];
const order = await db.order.findUniqueOrThrow({ where: { guestToken: token }, include: { items: true } });
await db.orderItem.update({
  where: { id: order.items[0].id },
  data: {
    options: {
      first: "Ann",
      surname: "Kamau",
      birth: "1980",
      parents: "John Kamau\nGrace Kamau",
      fatherParents: "Old Kamau\nOld Wanjiru",
      motherParents: "Old Mwangi\nOld Njeri",
      spouse: "Tom Otieno",
      children: "Lucy Otieno\nBen Otieno",
      materialKey: "wood",
      sizeKey: "wall",
      relation: "other",
    },
  },
});
console.log("filled", token);
await db.$disconnect();
