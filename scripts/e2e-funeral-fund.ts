// The funeral fund (harambee) against a real database: a programme ordered with the family's own
// M-Pesa opens the fund on the memorial; contributors can pledge; a fund with nowhere to send money
// takes nothing; the platform's own till is never shown.
//   DATABASE_URL=... AUTH_SECRET=x APP_URL=http://localhost:3000 tsx scripts/e2e-funeral-fund.ts
import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";
import { addItemToCart } from "../src/lib/cart";
import { checkoutCart } from "../src/lib/orders";
import { ensureMemorialFund, fundByToken, recordPledge } from "../src/lib/chama";
import { describeDestination } from "../src/lib/fund-destination";
import { renderItemSheet } from "../src/lib/print-order";
import type { DraftOptions } from "../src/lib/order-shared";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);
  await db.paymentSettings.update({ where: { scope: "global" }, data: { tillNumber: "999999" } });
  const prog = await db.product.update({ where: { slug: "funeral-programme" }, data: { active: true } });
  const family = await db.user.create({ data: { email: `fund-${RUN}@example.com`, name: "Jane Okusimba" } });
  const options: DraftOptions = {
    first: "Hesbon", surname: "Musungu", birth: "1948", death: "2026", relation: "child",
    fundKind: "PHONE", fundNumber: "0712 345 678", fundName: "Jane Okusimba",
    materialKey: "gloss", finishKey: "colour", sizeKey: "a5", pagesKey: "4", copiesKey: "100",
  };
  await addItemToCart(family.id, prog.slug, options);
  const cart = await db.order.findFirstOrThrow({ where: { userId: family.id, status: "DRAFT" } });
  const res = await checkoutCart(family.id, cart.id, { contactName: "Jane Okusimba", contactPhone: "0712345678", deliveryText: "Vihiga" });
  check("the order is placed", !!res, res);
  if (!res) return;

  const order = await db.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { items: true } });
  const memorialId = (order.items[0]!.layoutSnapshot as { memorialId?: string }).memorialId!;
  const fund = await db.chamaFund.findUnique({ where: { memorialId } });
  check("the programme opened the funeral fund on the memorial", !!fund, fund);
  check("money goes to the family's own phone", fund?.payKind === "PHONE" && fund.payNumber === "254712345678" && fund.payName === "Jane Okusimba", fund);

  const shown = await fundByToken(fund!.publicToken);
  const line = shown ? describeDestination(shown) : null;
  check("the contribute page shows the family's number", line === "M-Pesa 0712 345 678 (Jane Okusimba)", line);
  check("and never the shop's till", !String(line).includes("999999"));

  const pledge = await recordPledge(fund!.publicToken, { name: "Paul Musungu", amountKes: 2000, mpesaCode: "SJK3ABCDEF" });
  check("a mourner can record a contribution", pledge.ok, pledge);

  const sheet = await renderItemSheet(order.items[0]!.id);
  check("the programme's back page asks people to contribute", (sheet?.sheet.pages?.at(-1) ?? "").includes("SCAN TO CONTRIBUTE"));

  // a fund opened before the family said where money goes takes nothing
  const other = await db.memorial.findFirstOrThrow({ where: { id: { not: memorialId } }, select: { id: true, treeId: true, tree: { select: { workspaceId: true } } } }).catch(() => null);
  if (other && !(await db.chamaFund.findUnique({ where: { memorialId: other.id } }))) {
    const bare = await ensureMemorialFund(other.treeId, other.id, { workspaceId: other.tree.workspaceId, label: "Old fund" });
    const r = await recordPledge(bare.token, { name: "Someone", amountKes: 500 });
    check("a fund with nowhere to send money takes no contributions", !r.ok, r);
    await ensureMemorialFund(other.treeId, other.id, { workspaceId: other.tree.workspaceId, label: "Old fund", destination: { payKind: "TILL", payNumber: "765432", payAccount: null, payName: "Kamau Family" } });
    const r2 = await recordPledge(bare.token, { name: "Someone", amountKes: 500 });
    check("once the family adds their number, it does", r2.ok, r2);
  } else {
    console.log("skip  (no second memorial without a fund to test the old-fund path)");
  }

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(failed ? 1 : 0);
  });
