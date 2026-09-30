// Creating an account against a real database: who may, who may not, and what is stored.
//   DATABASE_URL=... AUTH_SECRET=x tsx scripts/e2e-signup.ts
import { PrismaClient } from "@prisma/client";

import { hashPassword, verifyPassword } from "../src/lib/password";
import { safeNext } from "../src/app/join/safe-next";
import { ensurePersonalWorkspace } from "../src/lib/workspace";

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};

// where people are sent after signing up: only pages on this site
check("a normal page is allowed", safeNext("/cart") === "/cart");
check("a protocol-relative address is refused", safeNext("//evil.example") === "/shop");
check("an absolute address is refused", safeNext("https://evil.example") === "/shop");
check("a backslash trick is refused", safeNext("/" + String.fromCharCode(92) + "evil.example") === "/shop");
check("empty goes to the shop", safeNext("") === "/shop");

// a stored password is a hash, and only the right one opens it
const hash = await hashPassword("a-long-password-1");
check("the password is not stored as typed", !hash.includes("a-long-password-1"));
check("the right password opens it", await verifyPassword("a-long-password-1", hash));
check("a wrong password does not", !(await verifyPassword("a-long-password-2", hash)));

// a new account gets its own workspace, once
const email = `signup-${Date.now()}@example.com`;
const u = await db.user.create({ data: { email, name: "Ann Kamau", passwordHash: hash } });
await ensurePersonalWorkspace(u.id, "Ann Kamau");
await ensurePersonalWorkspace(u.id, "Ann Kamau");
check("one personal workspace, not two", (await db.membership.count({ where: { userId: u.id } })) === 1);
check("the email is unique, so nobody can be registered twice", await db.user.create({ data: { email, name: "Again" } }).then(() => false, () => true));

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
await db.$disconnect();
process.exit(failed ? 1 : 0);
