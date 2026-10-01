// Email, end to end, against the real site and a mail sink that keeps what it is sent.
//   node scripts/smtp-sink.mjs 2526 .mail &
//   EMAIL_SERVER=smtp://127.0.0.1:2526 EMAIL_FROM="Family Compass <shop@test.local>" next dev -p 3124 &
//   DATABASE_URL=... tsx scripts/drive-email.ts [base url]
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";

const B = process.argv[2] ?? "http://localhost:3124";
const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RUN = Date.now();
let ipn = 0;
const ip = () => `10.${(RUN % 250) + 1}.${Math.floor(++ipn / 250)}.${ipn % 250}`;

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Post one of a page's own forms the way a browser would: its hidden fields carry the action. */
async function postForm(path: string, marker: RegExp, fields: Record<string, string>, cookie = "") {
  const page = await (await fetch(B + path, { headers: { cookie, "x-forwarded-for": ip() } })).text();
  const chunk = page.split("<form").slice(1).map((c) => c.split("</form>")[0]!).find((c) => marker.test(c));
  if (!chunk) throw new Error(`no form matching ${marker} on ${path}`);
  const form = new FormData();
  for (const m of chunk.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(m[0])?.[1];
    if (name?.startsWith("$ACTION")) form.append(decode(name), decode(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
  }
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await fetch(B + path, { method: "POST", body: form, redirect: "manual", headers: { cookie, "x-forwarded-for": ip() } });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const session = setCookie.map((c) => /authjs\.session-token=([^;]+)/.exec(c)?.[1]).find(Boolean);
  return { status: res.status, location: res.headers.get("location") ?? "", session: session ? `authjs.session-token=${session}` : "" };
}

/** What the sink has received, as simple records. */
type Mail = { to: string; subject: string; text: string; html: string; raw: string };
function inbox(): Mail[] {
  if (!fs.existsSync(".mail")) return [];
  return fs.readdirSync(".mail").sort().map((f) => {
    const raw = fs.readFileSync(`.mail/${f}`, "utf8");
    // undo quoted-printable line folding and escapes so links and words can be searched
    const flat = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const header = (h: string) => new RegExp(`^${h}: (.*)$`, "mi").exec(flat)?.[1]?.trim() ?? "";
    const html = /<!doctype html>[\s\S]*<\/html>/i.exec(flat)?.[0] ?? "";
    return { to: header("To"), subject: header("Subject"), text: flat, html, raw };
  });
}
async function mailFor(to: string, subject: RegExp, waitMs = 6000): Promise<Mail | undefined> {
  const until = Date.now() + waitMs;
  do {
    const m = inbox().find((x) => x.to.includes(to) && subject.test(x.subject));
    if (m) return m;
    await sleep(250);
  } while (Date.now() < until);
}
const linkIn = (m: Mail, re: RegExp) => re.exec(m.html || m.text)?.[0];

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);

  // ---- sign up: a welcome that asks them to confirm --------------------------------------------------
  const email = `shopper${RUN}@example.com`;
  const up = await postForm("/join?next=%2Fshop", /name="password"/, { name: "Ann Kamau", email, password: "a-long-password-1", next: "/shop" });
  check("an account is created and signed in", !!up.session, up);
  const welcome = await mailFor(email, /Welcome to Family Compass/);
  check("a welcome email arrives", !!welcome, inbox().map((m) => m.subject));
  check("it is addressed to her, by first name", !!welcome && welcome.text.includes("Hello Ann"), welcome?.text.slice(0, 200));
  check("it is a formatted email with a plain-text part too", !!welcome && welcome.html.includes("<h1") && /Content-Type: text\/plain/i.test(welcome.raw) && /Content-Type: text\/html/i.test(welcome.raw));
  const verify = welcome && linkIn(welcome, /https?:\/\/[^"\s<]*\/api\/auth\/verify\/[0-9a-f]+/);
  check("it carries a confirm link", !!verify, welcome?.html.slice(0, 300));
  const before = await db.user.findUniqueOrThrow({ where: { email } });
  check("she is not marked confirmed until she clicks", before.emailVerified === null);
  check("the shop asks her to confirm", (await (await fetch(`${B}/shop`, { headers: { cookie: up.session } })).text()).includes("Confirm your email"));

  // ---- the link confirms, once, and does not sign anyone in -----------------------------------------------
  const path = verify ? new URL(verify).pathname : "/api/auth/verify/none";
  const hit = await fetch(B + path, { redirect: "manual" });
  check("the link confirms the address", hit.status === 307 && (hit.headers.get("location") ?? "").includes("/shop?confirmed=1"), [hit.status, hit.headers.get("location")]);
  check("and it signed nobody in", !(hit.headers.getSetCookie?.() ?? []).some((c) => c.includes("session-token")));
  check("she is marked confirmed", (await db.user.findUniqueOrThrow({ where: { email } })).emailVerified !== null);
  const again = await fetch(B + path, { redirect: "manual" });
  check("the link works only once", (again.headers.get("location") ?? "").includes("BadLink"), again.headers.get("location"));
  check("the banner is gone once confirmed", !(await (await fetch(`${B}/shop`, { headers: { cookie: up.session } })).text()).includes("Confirm your email"));

  // a confirm token must never work as a sign-in link
  const vt = randomBytes(24).toString("hex");
  await db.loginToken.create({ data: { token: vt, userId: before.id, purpose: "verify", expiresAt: new Date(Date.now() + 864e5) } });
  const sneaky = await fetch(`${B}/api/auth/link/${vt}`, { redirect: "manual" });
  check("a confirm link cannot be used to sign in", (sneaky.headers.get("location") ?? "").includes("BadLink") && !(sneaky.headers.getSetCookie?.() ?? []).some((c) => c.includes("session-token")), sneaky.headers.get("location"));

  // ---- forgot password ---------------------------------------------------------------------------------------------
  const stranger = `nobody${RUN}@example.com`;
  const r1 = await postForm("/login/forgot", /name="email"/, { email: stranger });
  const r2 = await postForm("/login/forgot", /name="email"/, { email });
  check("the answer is the same whether or not there is an account", r1.location === r2.location && r1.location.includes("sent=1"), [r1.location, r2.location]);
  const reset = await mailFor(email, /sign-in link/i);
  check("the account holder gets a sign-in link", !!reset);
  await sleep(500);
  check("a stranger's address gets nothing", !inbox().some((m) => m.to.includes(stranger)));
  const resetLink = reset && linkIn(reset, /https?:\/\/[^"\s<]*\/api\/auth\/link\/[0-9a-f]+/);
  check("the email has the link", !!resetLink);
  const use = await fetch(B + new URL(resetLink!).pathname, { redirect: "manual" });
  check("the link signs her in", (use.headers.getSetCookie?.() ?? []).some((c) => c.includes("session-token")), use.status);
  const use2 = await fetch(B + new URL(resetLink!).pathname, { redirect: "manual" });
  check("and only once", (use2.headers.get("location") ?? "").includes("BadLink"), use2.headers.get("location"));

  // ---- an order: the receipt lists what was bought --------------------------------------------------------------------
  const product = await db.product.findUniqueOrThrow({ where: { slug: "family-tree-poster" } });
  const draftToken = `em_${RUN}`;
  await db.order.create({
    data: {
      guestToken: draftToken,
      items: { create: { productId: product.id, unitPriceKes: product.basePriceKes, options: { first: "Ann", surname: "Kamau", parents: "Peter Kamau\nMary Wanjiku", materialKey: "poster", sizeKey: "a2", finishKey: "white" } } },
    },
  });
  const add = await fetch(`${B}/order/${draftToken}/add`, { redirect: "manual", headers: { cookie: up.session } });
  check("the design goes into her cart", (add.headers.get("location") ?? "").includes("/cart"), add.headers.get("location"));
  await db.user.update({ where: { email }, data: { consentVersion: (await import("../src/lib/policy")).POLICY_VERSION, consentAt: new Date() } });
  const co = await postForm("/cart", /name="contactName"/, { contactName: "Ann Kamau", contactPhone: "0700111222", deliveryText: "Karen, Nairobi" }, up.session);
  check("she places the order and lands on the payment page", co.location.includes("/pay/"), co);
  const receipt = await mailFor(email, /We received your order/);
  check("a receipt arrives", !!receipt);
  check("it lists the item and the total", !!receipt && receipt.text.includes("Family tree wall poster x 1") && /Total: KES [\d,]+/.test(receipt.text), receipt?.text.slice(0, 600));
  check("it says delivery is included", !!receipt && receipt.text.includes("Delivery is included"));
  check("its button goes to the payment page", !!receipt && /href="https?:\/\/[^"]*\/pay\//.test(receipt.html));

  // ---- the people running the shop are emailed when money is waiting -------------------------------------------------------
  const adminEmail = `owner${RUN}@example.com`;
  const admin = await db.user.create({ data: { email: adminEmail, name: "Shop Owner", isPlatformAdmin: true, consentVersion: (await import("../src/lib/policy")).POLICY_VERSION, consentAt: new Date() } });
  const adminSession = randomBytes(24).toString("hex");
  await db.session.create({ data: { sessionToken: adminSession, userId: admin.id, expires: new Date(Date.now() + 864e5) } });
  const payPath = new URL(co.location, B).pathname;
  const sub = await postForm(payPath, /name="mpesaCode"/, { mpesaCode: "QWE123RTY9", payerPhone: "0700111222" }, up.session);
  check("she submits her M-Pesa code", sub.status < 400, sub);
  const alert = await mailFor(adminEmail, /Payment to verify/);
  check("the owner is emailed that a payment needs checking", !!alert, inbox().map((m) => `${m.to}: ${m.subject}`));
  check("it says how much and which code", !!alert && /KES [\d,]+/.test(alert.text) && alert.text.includes("QWE123RTY9"), alert?.text.slice(0, 400));

  // ---- the admin's test button ---------------------------------------------------------------------------------------------
  const cookie = `authjs.session-token=${adminSession}`;
  const t = await postForm("/admin/launch", /Send me a test email/, {}, cookie);
  check("the test button redirects with a result", t.location.includes("test=ok"), t);
  const test = await mailFor(adminEmail, /test email/i);
  check("the test email arrives", !!test);
  check("the launch page now reports email as set up", (await (await fetch(`${B}/admin/launch`, { headers: { cookie } })).text()).includes("Email is set up"));
  check("a signed-out visitor cannot press it", (await fetch(`${B}/admin/launch`, { redirect: "manual" })).status === 307);

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
