// Family Compass against Chama's partner API (funeral funds), with a stand-in Chama server that
// speaks the contract in Chama's docs/api.md ("Partner API — funeral funds", Chama 67c3a71).
// Checks: a programme order opens the fund on Chama with the family's payout and the customer as
// chair; Chama being off keeps the family's own M-Pesa; signed webhooks update totals and are
// refused when forged, stale or resent; the committee can convert; a bereavement referral from a
// chama earns the group its commission.
//   DATABASE_URL=... AUTH_SECRET=x APP_URL=http://localhost:3000 tsx --conditions=react-server scripts/e2e-chama-partner.ts
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = 4545;
const TOKEN = "familycompass-test-token-0123456789";
const SECRET = "fund-webhook-secret-from-chama";
const REFERRAL_SECRET = "shared-referral-secret-0123456789";
process.env.CHAMA_PARTNER_URL = `http://localhost:${PORT}`;
process.env.CHAMA_PARTNER_TOKEN = TOKEN;
process.env.CHAMA_REFERRAL_SECRET = REFERRAL_SECRET;

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const RUN = Date.now();

// ---- the stand-in Chama ------------------------------------------------------------------
type Req = { method: string; url: string; auth: string; body: Record<string, unknown> };
const seen: Req[] = [];
let walletsOn = true;
const funds = new Map<string, number>(); // ref -> fundId
// fund ids unique to this run, so a second run never collides with the first one's rows
const FIRST = 100_000 + (Date.now() % 800_000);
let nextId = FIRST;
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    seen.push({ method: req.method!, url: req.url!, auth: String(req.headers.authorization ?? ""), body });
    const send = (status: number, b: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(b));
    };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "Invalid or missing partner token" });
    if (req.method === "POST" && req.url === "/api/partner/v1/funds") {
      if (!walletsOn) return send(503, { error: "Group wallets are switched off" });
      const existing = funds.get(body.ref);
      const fundId = existing ?? nextId++;
      funds.set(body.ref, fundId);
      return send(existing ? 200 : 201, {
        fundId, ref: body.ref, name: body.name, deceasedName: body.deceasedName, status: "open", closesOn: "2026-12-23",
        targetKes: body.targetKes ?? null, branches: body.branches ?? [], giveUrl: `http://chama.test/f/tok${fundId}`,
        ...(existing ? {} : { webhookSecret: SECRET }), invites: [],
      });
    }
    if (req.method === "POST" && /\/funds\/\d+\/webhook-secret$/.test(req.url!)) return send(200, { webhookSecret: SECRET });
    const m = req.url!.match(/^\/api\/partner\/v1\/funds\/(\d+)(\/convert)?$/);
    if (m && req.method === "GET") return send(200, { fundId: Number(m[1]), status: "open", giveUrl: `http://chama.test/f/tok${m[1]}`, total: 1500, giftCount: 2, byBranch: [{ branch: "Willy Okusimba's household", total: 1000, count: 1 }], recent: [] });
    if (m && m[2] && req.method === "POST") return send(200, { groupId: Number(m[1]), status: "converted", invites: (body.members as unknown[]).map((x) => ({ phone: (x as { phone: string }).phone, invited: true, sms: true })) });
    send(404, { error: "not found" });
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(PORT, r));
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const { seedPaymentSettings, seedProducts } = await import("../prisma/seed-lib");
  const { addItemToCart } = await import("../src/lib/cart");
  const { checkoutCart } = await import("../src/lib/orders");
  const { recordPledge } = await import("../src/lib/chama");
  const { signChama } = await import("../src/lib/chama-signature");
  const { convertFund } = await import("../src/lib/chama-partner");
  const { refreshFromChama } = await import("../src/lib/chama-partner-funds");
  const webhook = await import("../src/app/api/partners/chama/webhook/route");
  const bereavement = await import("../src/app/api/partners/chama/bereavement/route");
  const { referrerForCheckout } = await import("../src/lib/referrals");
  const { fulfilPayment } = await import("../src/lib/payments/fulfil");

  await seedPaymentSettings(db);
  await seedProducts(db);
  const prog = await db.product.update({ where: { slug: "funeral-programme" }, data: { active: true } });

  async function order(email: string) {
    const user = await db.user.create({ data: { email, name: "Jane Okusimba" } });
    await addItemToCart(user.id, prog.slug, {
      first: "Hesbon", surname: "Musungu", birth: "1948", death: "2026", relation: "child",
      children: "Willy Okusimba\nJane Okusimba", spouse: "Rose Musungu",
      fundKind: "PHONE", fundNumber: "0712 345 678", fundName: "Jane Okusimba",
      materialKey: "gloss", finishKey: "colour", sizeKey: "a5", pagesKey: "4", copiesKey: "100",
    });
    const cart = await db.order.findFirstOrThrow({ where: { userId: user.id, status: "DRAFT" } });
    const res = await checkoutCart(user.id, cart.id, { contactName: "Jane Okusimba", contactPhone: "0722 111 222", deliveryText: "Vihiga" });
    const o = await db.order.findUniqueOrThrow({ where: { id: res!.orderId }, include: { items: true } });
    const memorialId = (o.items[0]!.layoutSnapshot as { memorialId: string }).memorialId;
    return { user, order: o, memorialId, fund: await db.chamaFund.findUniqueOrThrow({ where: { memorialId } }) };
  }

  // 1. a programme order opens the fund on Chama
  const a = await order(`partner-a-${RUN}@example.com`);
  const create = seen.find((r) => r.method === "POST" && r.url === "/api/partner/v1/funds");
  check("the order created a fund on Chama, with our token", !!create && create.auth === `Bearer ${TOKEN}`, create?.auth);
  check("keyed to the memorial, so a retry never makes a second fund", create?.body.ref === a.memorialId, create?.body.ref);
  check("paid out only to the family's own M-Pesa", JSON.stringify(create?.body.payout) === JSON.stringify({ kind: "mpesa", phone: "254712345678", name: "Jane Okusimba" }), create?.body.payout);
  const committee = create?.body.committee as { name: string; phone: string; role: string }[] | undefined;
  check("the customer chairs the committee", committee?.length === 1 && committee[0]!.role === "chair" && committee[0]!.phone === "0722111222", committee);
  check("branches come from the family", JSON.stringify(create?.body.branches) === JSON.stringify(["Rose Musungu's side", "Willy Okusimba's household", "Jane Okusimba's household"]), create?.body.branches);
  check("Chama is told where to send events", String(create?.body.webhookUrl).endsWith("/api/partners/chama/webhook"), create?.body.webhookUrl);
  check("we keep Chama's fund, page and secret", a.fund.partnerFundId === FIRST && a.fund.partnerGiveUrl === `http://chama.test/f/tok${FIRST}` && a.fund.partnerSecret === SECRET, a.fund);
  // the first create's answer was lost: a retry gets the same fund without its secret, and asks for a new one
  const { linkFundToChama } = await import("../src/lib/chama-partner-funds");
  await db.chamaFund.update({ where: { id: a.fund.id }, data: { partnerFundId: null, partnerSecret: null } });
  const relink = await linkFundToChama(a.fund.id, { name: "Jane Okusimba", phone: "0722111222" });
  const relinked = await db.chamaFund.findUniqueOrThrow({ where: { id: a.fund.id } });
  check("a lost secret is re-issued", relink.linked && relinked.partnerFundId === FIRST && relinked.partnerSecret === SECRET && seen.some((r) => r.url.endsWith("/webhook-secret")), relinked);
  check("a Chama-run fund takes no hand-recorded pledges", !(await recordPledge(a.fund.publicToken, { name: "Paul", amountKes: 500 })).ok);

  // 2. Chama's wallets off: the fund stays on the family's own M-Pesa
  walletsOn = false;
  const b = await order(`partner-b-${RUN}@example.com`);
  check("with Chama's wallets off, the fund stays on the family's own M-Pesa", b.fund.partnerFundId === null && b.fund.payNumber === "254712345678", b.fund);
  check("and still takes hand-recorded pledges", (await recordPledge(b.fund.publicToken, { name: "Paul", amountKes: 500 })).ok);
  walletsOn = true;

  // 3. signed webhooks
  const post = (body: object, opts: { secret?: string; ts?: number } = {}) => {
    const raw = JSON.stringify(body);
    const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
    return webhook.POST(new Request("http://x/api/partners/chama/webhook", {
      method: "POST",
      headers: { "x-chama-timestamp": ts, "x-chama-signature-256": signChama(opts.secret ?? SECRET, ts, raw), "content-type": "application/json" },
      body: raw,
    }));
  };
  const gift = { eventId: randomUUID(), event: "fund.gift.paid", groupId: FIRST, occurredAt: new Date().toISOString(),
    data: { fundId: FIRST, ref: a.memorialId, giftId: 1, name: "Paul Musungu", amount: 2000, branch: "Willy Okusimba's household", message: "Pole", total: 2000, giftCount: 1, byBranch: [{ branch: "Willy Okusimba's household", total: 2000, count: 1 }] } };
  check("a forged webhook is refused", (await post(gift, { secret: "wrong" })).status === 401);
  check("a stale webhook is refused", (await post(gift, { ts: Math.floor(Date.now() / 1000) - 600 })).status === 401);
  check("a genuine webhook is accepted", (await post(gift)).status === 200);
  let f = await db.chamaFund.findUniqueOrThrow({ where: { id: a.fund.id } });
  check("the total and branches are updated", f.partnerTotalKes === 2000 && f.partnerGiftCount === 1 && JSON.stringify(f.partnerByBranch).includes("Willy"), f);
  const dup = await post({ ...gift, data: { ...gift.data, total: 999999 } });
  check("a resent event is acknowledged and ignored", dup.status === 200 && (await db.chamaFund.findUniqueOrThrow({ where: { id: a.fund.id } })).partnerTotalKes === 2000);
  const tree = (await db.memorial.findUniqueOrThrow({ where: { id: a.memorialId } })).treeId;
  check("the family is told about the gift", (await db.notification.count({ where: { treeId: tree, kind: "fund.gift" } })) >= 1);
  await post({ eventId: randomUUID(), event: "fund.closed", groupId: FIRST, data: { fundId: FIRST, ref: a.memorialId, total: 2500, giftCount: 2 } });
  f = await db.chamaFund.findUniqueOrThrow({ where: { id: a.fund.id } });
  check("a closed fund is shown closed", f.partnerStatus === "closed" && f.partnerTotalKes === 2500, f);

  // 4. reading totals, and converting after the burial
  await db.chamaFund.update({ where: { id: a.fund.id }, data: { partnerSyncedAt: new Date(0) } });
  await refreshFromChama(a.fund.id);
  f = await db.chamaFund.findUniqueOrThrow({ where: { id: a.fund.id } });
  check("totals are read from Chama when stale", f.partnerTotalKes === 1500 && f.partnerGiftCount === 2, f);
  const conv = await convertFund(FIRST, [{ name: "John Kamau", phone: "0733000001" }]);
  check("the committee can become a family chama", conv.ok && conv.data.groupId === FIRST, conv);

  // 5. a bereavement referral from a chama
  const refer = (body: object, secret = REFERRAL_SECRET) => {
    const raw = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    return bereavement.POST(new Request("http://x/api/partners/chama/bereavement", {
      method: "POST", headers: { "x-chama-timestamp": ts, "x-chama-signature-256": signChama(secret, ts, raw) }, body: raw,
    }));
  };
  const groupId = 7000 + (RUN % 1000);
  const evt = { eventId: randomUUID(), event: "bereavement.approved", groupId, groupName: "Upendo Welfare", referrerCode: `chama-${groupId}`, payout: { kind: "paybill", paybill: "222111", accountRef: "UPENDO", name: "Upendo Welfare" } };
  check("an unsigned referral is refused", (await refer(evt, "nope")).status === 401);
  const r1 = await refer(evt);
  const link = ((await r1.json()) as { link?: string }).link ?? "";
  check("a referral returns a link on our own site to the programme", r1.status === 200 && /\/r\/CHAMA\d+/.test(link) && link.includes("funeral-programme"), link);
  const ref = await db.referrer.findUnique({ where: { externalRef: `chama-${groupId}` } });
  check("the chama group becomes a referrer, with its payout account", ref?.kind === "chama" && ref.userId === null && JSON.stringify(ref.payout).includes("222111"), ref);
  const again = ((await (await refer({ ...evt, eventId: randomUUID() })).json()) as { link?: string }).link;
  check("the same group always gets the same link", again === link, [again, link]);

  // the family orders through the link: the group earns its 10%
  const c = await db.user.create({ data: { email: `partner-c-${RUN}@example.com`, name: "Akinyi" } });
  await addItemToCart(c.id, prog.slug, { first: "Otieno", surname: "Odhiambo", death: "2026", materialKey: "gloss", finishKey: "mono", sizeKey: "a5", pagesKey: "4", copiesKey: "50" });
  const cart = await db.order.findFirstOrThrow({ where: { userId: c.id, status: "DRAFT" } });
  const referrerId = await referrerForCheckout(c.id, null, ref!.code);
  const placed = await checkoutCart(c.id, cart.id, { contactName: "Akinyi", contactPhone: "0700000001", deliveryText: "Kisumu" }, referrerId);
  const pay = await db.payment.findFirstOrThrow({ where: { orderId: placed!.orderId } });
  await fulfilPayment(pay.id, {});
  const commission = await db.referralCommission.findUnique({ where: { orderId: placed!.orderId } });
  check("the chama group earns 10% of the order", commission?.referrerId === ref!.id && commission.amountKes === Math.floor(pay.amountKes / 10), commission);

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  await db.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(() => {
    server.close();
    process.exit(failed ? 1 : 0);
  });
