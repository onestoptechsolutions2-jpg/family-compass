// Facts the landing-page drive needs: which products are on sale, and a memorial and family page a QR opens.
//   tsx scripts/prep-landing.ts -> prints JSON
import { PrismaClient } from "@prisma/client";
import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";

const db = new PrismaClient();
await seedPaymentSettings(db);
await seedProducts(db);
const active = await db.product.findMany({ where: { active: true }, select: { slug: true, name: true, basePriceKes: true, pathway: true }, orderBy: { sortOrder: "asc" } });
const off = await db.product.findMany({ where: { active: false }, select: { name: true } });
const memorial = await db.memorial.findFirst({ where: { published: true }, select: { slug: true } });
const view = await db.sharedView.findFirst({ where: { revoked: false }, select: { slug: true } });
console.log(JSON.stringify({ active, off: off.map((p) => p.name), memorial: memorial?.slug ?? null, view: view?.slug ?? null }));
await db.$disconnect();
