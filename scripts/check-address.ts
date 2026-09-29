// The receiving address saved in admin settings reaches getPaymentSettings, next to the bank details.
import { PrismaClient } from "@prisma/client";
import { getPaymentSettings } from "../src/lib/payments";

const db = new PrismaClient();
const before = await getPaymentSettings();
await db.paymentSettings.update({
  where: { scope: "global" },
  data: { config: { receivingAddress: "Workshop 4, Industrial Area, Nairobi. Mon-Sat 8-5. Ask for Ann.", bankTransfer: { bank: "KCB", branch: "Lowdar", accountNo: "1320390277", accountName: "Leitor" } } },
});
const s = await getPaymentSettings();
const ok = s.receivingAddress?.startsWith("Workshop 4") && s.bankTransfer?.bank === "KCB";
console.log(before.receivingAddress === null || typeof before.receivingAddress === "string" ? "PASS  default is empty or set" : "FAIL default");
console.log(ok ? "PASS  address saved alongside bank details" : "FAIL address/bank " + JSON.stringify(s));
await db.$disconnect();
process.exit(ok ? 0 : 1);
