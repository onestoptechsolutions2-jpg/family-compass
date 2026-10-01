// Product photos, end to end: an admin uploads, the shop shows it, bad files are refused, nobody else can.
//   DATABASE_URL=... tsx scripts/drive-photos.ts [base url]
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

import { POLICY_VERSION } from "../src/lib/policy";
import { seedPaymentSettings, seedProducts } from "../prisma/seed-lib";

const B = process.argv[2] ?? "http://localhost:3124";
const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function postForm(path: string, marker: RegExp, fields: Record<string, string | File>, cookie: string) {
  const page = await (await fetch(B + path, { headers: { cookie } })).text();
  const chunk = page.split("<form").slice(1).map((c) => c.split("</form>")[0]!).find((c) => marker.test(c));
  if (!chunk) throw new Error(`no form matching ${marker}`);
  const form = new FormData();
  for (const m of chunk.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(m[0])?.[1];
    if (name?.startsWith("$ACTION")) form.append(decode(name), decode(/value="([^"]*)"/.exec(m[0])?.[1] ?? ""));
  }
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await fetch(B + path, { method: "POST", body: form, redirect: "manual", headers: { cookie } });
  return res.status;
}

const picture = (w: number, h: number, colour: string) => sharp({ create: { width: w, height: h, channels: 3, background: colour } }).jpeg().toBuffer();
const file = (buf: Buffer, name: string, type: string) => new File([new Uint8Array(buf)], name, { type });

async function main() {
  await seedPaymentSettings(db);
  await seedProducts(db);
  const agreed = { consentVersion: POLICY_VERSION, consentAt: new Date() };
  const tag = Date.now();
  const mk = async (admin: boolean) => {
    const u = await db.user.create({ data: { email: `${admin ? "admin" : "shopper"}-${tag}@example.com`, name: "X", isPlatformAdmin: admin, ...agreed } });
    const t = randomBytes(24).toString("hex");
    await db.session.create({ data: { sessionToken: t, userId: u.id, expires: new Date(Date.now() + 864e5) } });
    return `authjs.session-token=${t}`;
  };
  const admin = await mk(true);
  const shopper = await mk(false);
  const product = await db.product.findUniqueOrThrow({ where: { slug: "desk-family-tree" } });
  await db.productImage.deleteMany({ where: { productId: product.id } });
  const marker = /e\.g\. Desk family tree on a wall/;
  const count = () => db.productImage.count({ where: { productId: product.id } });

  // ---- before any photo: a generic picture of the product ---------------------------------------------------------------
  let html = await (await fetch(`${B}/shop/desk-family-tree`)).text();
  check("with no photo the shop shows a generic picture", html.includes("/api/sample/desk-family-tree"));
  const generic = await fetch(`${B}/api/sample/desk-family-tree`);
  check("which is a real image", generic.status === 200 && generic.headers.get("content-type") === "image/webp" && (await generic.arrayBuffer()).byteLength > 2000);
  check("and the admin page says there is none yet", (await (await fetch(`${B}/admin/products`, { headers: { cookie: admin } })).text()).includes("none yet"));

  // ---- upload ---------------------------------------------------------------------------------------------------------------
  const s1 = await postForm("/admin/products", marker, { photo: file(await picture(2000, 1500, "#aa6633"), "desk.jpg", "image/jpeg"), alt: "The desk tree on a shelf" }, admin);
  check("an admin uploads a photo", s1 < 400, s1);
  check("it is stored", (await count()) === 1);
  const img = await db.productImage.findFirstOrThrow({ where: { productId: product.id } });
  check("stored as a web picture, resized, with a small copy", img.mimeType === "image/webp" && (await sharp(img.bytes).metadata()).width === 1600 && (await sharp(img.thumb).metadata()).width === 720);

  html = await (await fetch(`${B}/shop/desk-family-tree`)).text();
  check("the product page now shows the photo, with its description", html.includes(`/api/product-image/${img.id}`) && html.includes("The desk tree on a shelf"));
  check("and no longer the drawn picture", !html.includes("/api/sample/desk-family-tree"));
  check("the shop shows its small copy", (await (await fetch(`${B}/shop`)).text()).includes(`/api/product-image/${img.id}?size=thumb`));
  check("so does the landing page", (await (await fetch(`${B}/`)).text()).includes(`/api/product-image/${img.id}?size=thumb`));
  const big = await fetch(`${B}/api/product-image/${img.id}`);
  const small = await fetch(`${B}/api/product-image/${img.id}?size=thumb`);
  check("the photo is served, as an image that can be kept for a year", big.status === 200 && big.headers.get("content-type") === "image/webp" && /max-age=31536000/.test(big.headers.get("cache-control") ?? ""));
  check("the small copy is smaller", (await small.arrayBuffer()).byteLength < (await big.arrayBuffer()).byteLength);

  // ---- bad files ---------------------------------------------------------------------------------------------------------------
  const fakes: [string, File][] = [
    ["an SVG pretending to be a PNG", file(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"), "x.png", "image/png")],
    ["a PDF", file(Buffer.from("%PDF-1.4 hello"), "x.pdf", "application/pdf")],
    ["a tiny picture", file(await picture(100, 80, "#000"), "tiny.jpg", "image/jpeg")],
    ["an oversize file", file(Buffer.alloc(9 * 1024 * 1024, 1), "huge.jpg", "image/jpeg")],
  ];
  for (const [what, f] of fakes) {
    await postForm("/admin/products", marker, { photo: f, alt: "" }, admin).catch(() => 0);
    check(`${what} is refused`, (await count()) === 1, await count());
  }

  // ---- who can ---------------------------------------------------------------------------------------------------------------------
  await postForm("/admin/products", marker, { photo: file(await picture(1200, 900, "#336699"), "x.jpg", "image/jpeg"), alt: "" }, admin); // a second one, as admin
  check("a second photo is added after the first", (await count()) === 2);
  const adminPage = await (await fetch(`${B}/admin/products`, { headers: { cookie: shopper }, redirect: "manual" })).status;
  check("a shopper cannot open the admin page", adminPage === 307, adminPage);
  const anon = await fetch(`${B}/admin/products`, { redirect: "manual" });
  check("neither can a visitor", anon.status === 307);

  // the admin can choose the main photo, and remove one
  const order = () => db.productImage.findMany({ where: { productId: product.id }, orderBy: [{ sortOrder: "asc" }], select: { id: true } });
  const [firstId, secondId] = (await order()).map((x) => x.id) as [string, string];
  await postForm("/admin/products", new RegExp(`${secondId}[^]*Make main|Make main[^]*${secondId}`), {}, admin);
  check("Make main puts that photo first", (await order())[0]!.id === secondId, await order());
  check("and the shop shows it first", ((await (await fetch(`${B}/shop/desk-family-tree`)).text()).indexOf(secondId) < (await (await fetch(`${B}/shop/desk-family-tree`)).text()).indexOf(firstId)));
  await postForm("/admin/products", new RegExp(`${secondId}[^]*Remove|Remove[^]*${secondId}`), {}, admin);
  check("Remove deletes just that photo", (await count()) === 1 && (await order())[0]!.id === firstId, await order());

  // ---- a product that is off sale does not show its photos to the public --------------------------------------------------------
  await db.product.update({ where: { id: product.id }, data: { active: false } });
  const hidden = await fetch(`${B}/api/product-image/${img.id}`);
  check("an off-sale product's photo is not public", hidden.status === 404);
  const forAdmin = await fetch(`${B}/api/product-image/${img.id}`, { headers: { cookie: admin } });
  check("but the admin can still see it", forAdmin.status === 200 && (forAdmin.headers.get("cache-control") ?? "").includes("no-store"));
  await db.product.update({ where: { id: product.id }, data: { active: true } });

  // ---- remove -------------------------------------------------------------------------------------------------------------------------
  await db.productImage.deleteMany({ where: { productId: product.id } });
  html = await (await fetch(`${B}/shop/desk-family-tree`)).text();
  check("with no photos left the generic picture is back", html.includes("/api/sample/desk-family-tree"));
  check("a removed photo is gone", (await fetch(`${B}/api/product-image/${img.id}`)).status === 404);

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
