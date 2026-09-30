import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { GenerationKind, type PrismaClient } from "@prisma/client";

import { hashPassword, passwordProblem } from "../src/lib/password";
import { KENYA_ALL_ROWS as KENYA_LOCATION_ROWS } from "./data/kenya-national";
import { REFERENCE_CLAN_ROWS } from "./data/reference-clans";

const normalizeClan = (s: string) =>
  s.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").replace(/[^a-z0-9 '-]/g, "");

/** Best-effort public origin. `docker exec` shells (Coolify terminal) don't
 *  inherit the compose `environment:` block, so also read PID 1's env. */
function resolveOrigin(): string {
  const fromEnv = (e: NodeJS.ProcessEnv) =>
    e.APP_URL ||
    e.AUTH_URL ||
    e.NEXTAUTH_URL ||
    e.COOLIFY_URL ||
    (e.COOLIFY_FQDN ? `https://${e.COOLIFY_FQDN.split(",")[0]!.trim()}` : "");

  let origin = fromEnv(process.env);
  if (!origin) {
    try {
      const pid1 = Object.fromEntries(
        readFileSync("/proc/1/environ", "utf8")
          .split("\0")
          .filter(Boolean)
          .map((kv) => {
            const i = kv.indexOf("=");
            return [kv.slice(0, i), kv.slice(i + 1)];
          }),
      ) as NodeJS.ProcessEnv;
      origin = fromEnv(pid1);
    } catch {
      /* not linux / no /proc */
    }
  }
  return (origin || "https://YOUR-DOMAIN").replace(/\/$/, "");
}

const NANO = "23456789abcdefghijkmnpqrstuvwxyz";
const rand = (n: number) => Array.from(randomBytes(n), (b) => NANO[b % NANO.length]).join("");

/**
 * Launch catalogue. Prices are PLACEHOLDERS from docs/commerce/PLAN.md until
 * supplier quotes arrive; `update: {}` keeps any price an admin has changed.
 */
export async function seedProducts(db: PrismaClient): Promise<void> {
  const products = [
    {
      slug: "tile-plaque-qr",
      pathway: "REMEMBERED" as const,
      group: "Honour",
      name: "Memorial tile plaque with QR",
      summary: "A tile plaque with their name, dates and a QR code that opens their memorial and family tree.",
      basePriceKes: 30000,
      sortOrder: 10,
      options: {
        materials: [{ key: "tile", label: "Ceramic tile", addKes: 0 }],
        sizes: [{ key: "standard", label: "Standard (20 x 30 cm)", addKes: 0 }],
      },
    },
    {
      slug: "tombstone-family-tree",
      pathway: "REMEMBERED" as const,
      group: "Honour",
      name: "Tombstone family tree",
      summary: "A family tree engraved or tiled for the grave, with a QR code to the living family page.",
      basePriceKes: 60000,
      sortOrder: 20,
      options: {
        materials: [
          { key: "tile", label: "Ceramic tile", addKes: 0 },
          { key: "granite", label: "Granite", addKes: 0 },
        ],
        sizes: [{ key: "square", label: "Square (40 x 40 cm)", addKes: 0 }],
      },
    },
    {
      slug: "family-tree-poster",
      pathway: "LIVING" as const,
      group: "Display",
      name: "Family tree wall poster",
      summary: "Your family tree printed for the wall, with a QR code that opens your living family page.",
      basePriceKes: 8000,
      sortOrder: 10,
      options: {
        materials: [
          { key: "poster", label: "Printed poster", addKes: 0 },
          { key: "canvas", label: "Canvas", addKes: 0 },
        ],
        sizes: [
          { key: "a2", label: "A2", addKes: 0 },
          { key: "a1", label: "A1", addKes: 0 },
        ],
      },
    },
    {
      slug: "wooden-family-tree",
      pathway: "LIVING" as const,
      group: "Display",
      name: "Wooden family tree",
      summary: "Your family tree engraved in solid wood for the wall, with a QR code to your living family page.",
      basePriceKes: 15000,
      sortOrder: 20,
      options: {
        materials: [{ key: "wood", label: "Solid wood", addKes: 0 }],
        sizes: [{ key: "wall", label: "Wall (60 x 40 cm)", addKes: 0 }],
      },
    },
    // ---- Books and print, events and merchandise ------------------------------------
    // Off until real supplier prices are set (Admin > Products): a guessed price on a
    // product nobody has quoted for is how a shop loses money.
    {
      slug: "memorial-prayer-cards",
      pathway: "REMEMBERED" as const,
      group: "Remember",
      name: "Memorial prayer cards",
      summary: "Cards handed out at the service, with their name, dates and a verse. The QR code opens their memorial page.",
      basePriceKes: 5000,
      sortOrder: 10,
      layout: "card",
      active: false,
      options: {
        materials: [
          { key: "card", label: "Matt card, printed both sides", addKes: 0 },
          { key: "gloss", label: "Gloss laminated", addKes: 800 },
        ],
        sizes: [
          { key: "pack50", label: "Pack of 50", addKes: 0 },
          { key: "pack100", label: "Pack of 100", addKes: 3500 },
          { key: "pack200", label: "Pack of 200", addKes: 8000 },
        ],
      },
    },
    {
      slug: "family-birthday-calendar",
      pathway: "LIVING" as const,
      group: "Preserve",
      name: "Family birthday calendar",
      summary: "A year planner with every family birthday and anniversary on it. Relatives scan the QR code to add theirs.",
      basePriceKes: 3500,
      sortOrder: 20,
      layout: "calendar",
      active: false,
      options: {
        materials: [{ key: "paper", label: "Printed paper", addKes: 0 }],
        sizes: [
          { key: "a3", label: "A3 (30 x 42 cm)", addKes: 0 },
          { key: "a2", label: "A2 (42 x 59 cm)", addKes: 1500 },
        ],
      },
    },
    {
      slug: "framed-family-tree-print",
      pathway: "LIVING" as const,
      group: "Display",
      name: "Framed family tree print",
      summary: "Your family tree printed on quality paper and framed, ready to hang, with a QR code to your family page.",
      basePriceKes: 9500,
      sortOrder: 30,
      layout: "tree",
      active: false,
      options: {
        materials: [{ key: "poster", label: "Framed print", addKes: 0 }],
        sizes: [
          { key: "a3", label: "A3 (30 x 42 cm)", addKes: 0 },
          { key: "a2", label: "A2 (42 x 59 cm)", addKes: 4000 },
        ],
      },
    },
    {
      slug: "reunion-tshirt",
      pathway: "LIVING" as const,
      group: "Celebrate",
      name: "Family reunion T-shirt",
      summary: "One shirt for the whole clan: family name, year and place, with a QR code on the back to your family page. One size per line.",
      basePriceKes: 1500,
      sortOrder: 10,
      layout: "shirt",
      active: false,
      options: {
        materials: [{ key: "cotton", label: "Cotton T-shirt", addKes: 0 }],
        sizes: [
          { key: "tee_s", label: "Small", addKes: 0 },
          { key: "tee_m", label: "Medium", addKes: 0 },
          { key: "tee_l", label: "Large", addKes: 0 },
          { key: "tee_xl", label: "Extra large", addKes: 0 },
          { key: "tee_xxl", label: "Double extra large", addKes: 200 },
        ],
      },
    },
    {
      slug: "reunion-name-badges",
      pathway: "LIVING" as const,
      group: "Celebrate",
      name: "Reunion name badges",
      summary: "A badge for every guest with their name and how they are related to the host, so cousins meet cousins.",
      basePriceKes: 3000,
      sortOrder: 20,
      layout: "badges",
      active: false,
      options: {
        materials: [{ key: "card", label: "Printed card badges", addKes: 0 }],
        sizes: [
          { key: "badges20", label: "Up to 20 guests", addKes: 0 },
          { key: "badges50", label: "Up to 50 guests", addKes: 4500 },
        ],
      },
    },
    {
      slug: "reunion-banner",
      pathway: "LIVING" as const,
      group: "Celebrate",
      name: "Reunion banner",
      summary: "Your family tree at banner size with the event title, for the venue. The QR code takes guests to the family page.",
      basePriceKes: 12000,
      sortOrder: 30,
      layout: "banner",
      active: false,
      options: {
        materials: [{ key: "vinyl", label: "Vinyl banner", addKes: 0 }],
        sizes: [{ key: "banner", label: "Banner (200 x 100 cm)", addKes: 0 }],
      },
    },
    {
      slug: "wedding-family-tree",
      pathway: "LIVING" as const,
      group: "Celebrate",
      name: "Wedding family tree",
      summary: "Two families become one: both sets of parents above the couple, engraved in wood as a keepsake or gift.",
      basePriceKes: 18000,
      sortOrder: 40,
      layout: "wedding",
      active: false,
      options: {
        materials: [{ key: "wood", label: "Solid wood", addKes: 0 }],
        sizes: [{ key: "wall", label: "Wall (60 x 40 cm)", addKes: 0 }],
      },
    },
    {
      slug: "wedding-tree-poster",
      pathway: "LIVING" as const,
      group: "Celebrate",
      name: "Wedding family tree poster",
      summary: "Both families above the couple, printed large for the reception or as a gift. A QR code opens their family page.",
      basePriceKes: 6500,
      sortOrder: 50,
      layout: "wedding",
      active: false,
      options: {
        materials: [
          { key: "poster", label: "Printed poster", addKes: 0 },
        ],
        sizes: [
          { key: "a3", label: "A3 (30 x 42 cm)", addKes: 0 },
          { key: "a2", label: "A2 (42 x 59 cm)", addKes: 2500 },
        ],
      },
    },
    {
      slug: "wedding-tree-framed",
      pathway: "LIVING" as const,
      group: "Celebrate",
      name: "Framed wedding family tree",
      summary: "The two families joined, printed and framed, ready to give or hang.",
      basePriceKes: 12500,
      sortOrder: 60,
      layout: "wedding",
      active: false,
      options: {
        materials: [
          { key: "poster", label: "Framed print", addKes: 0 },
        ],
        sizes: [
          { key: "a3", label: "A3 (30 x 42 cm)", addKes: 0 },
          { key: "a2", label: "A2 (42 x 59 cm)", addKes: 4500 },
        ],
      },
    },
    {
      slug: "memorial-tree-poster",
      pathway: "REMEMBERED" as const,
      group: "Remember",
      name: "Funeral display family tree",
      summary: "Their family tree at poster size for the service, the church or the home. The QR code opens their memorial page.",
      basePriceKes: 7500,
      sortOrder: 40,
      layout: "tree",
      active: false,
      options: {
        materials: [
          { key: "poster", label: "Printed poster", addKes: 0 },
        ],
        sizes: [
          { key: "a2", label: "A2 (42 x 59 cm)", addKes: 0 },
          { key: "a1", label: "A1 (59 x 84 cm)", addKes: 3000 },
        ],
      },
    },
    {
      slug: "memorial-tree-framed",
      pathway: "REMEMBERED" as const,
      group: "Remember",
      name: "Framed memorial family tree",
      summary: "Their family tree, printed and framed, to keep in the home after the service.",
      basePriceKes: 11000,
      sortOrder: 50,
      layout: "tree",
      active: false,
      options: {
        materials: [
          { key: "poster", label: "Framed print", addKes: 0 },
        ],
        sizes: [
          { key: "a3", label: "A3 (30 x 42 cm)", addKes: 0 },
          { key: "a2", label: "A2 (42 x 59 cm)", addKes: 4000 },
        ],
      },
    },
    {
      slug: "memorial-wood-tree",
      pathway: "REMEMBERED" as const,
      group: "Remember",
      name: "Wooden memorial tree",
      summary: "Their family tree engraved in solid wood, with a QR code to their memorial page.",
      basePriceKes: 14000,
      sortOrder: 60,
      layout: "tree",
      active: false,
      options: {
        materials: [
          { key: "wood", label: "Solid wood", addKes: 0 },
        ],
        sizes: [
          { key: "standard", label: "Desk (20 x 30 cm)", addKes: 0 },
          { key: "wall", label: "Wall (60 x 40 cm)", addKes: 6000 },
        ],
      },
    },
    {
      slug: "desk-family-tree",
      pathway: "LIVING" as const,
      group: "Display",
      name: "Desk family tree",
      summary: "A small engraved wooden family tree for a desk or shelf. A thoughtful gift.",
      basePriceKes: 6500,
      sortOrder: 40,
      layout: "tree",
      active: false,
      options: {
        materials: [
          { key: "wood", label: "Solid wood", addKes: 0 },
        ],
        sizes: [
          { key: "standard", label: "Desk (20 x 30 cm)", addKes: 0 },
        ],
      },
    },
  ];
  // What each product needs to be made, and how it reaches the customer.
  const route: Record<string, { skills: string[]; shipVia: string; aisle: string }> = {
    "tile-plaque-qr": { skills: ["tile_printing"], shipVia: "direct", aisle: "memorial_stone" },
    "tombstone-family-tree": { skills: ["stone_engraving"], shipVia: "via_us", aisle: "memorial_stone" },
    "family-tree-poster": { skills: ["printing"], shipVia: "direct", aisle: "wall_art" },
    "wooden-family-tree": { skills: ["wood_engraving"], shipVia: "via_us", aisle: "wall_art" },
    "memorial-prayer-cards": { skills: ["printing"], shipVia: "direct", aisle: "books_print" },
    "family-birthday-calendar": { skills: ["printing"], shipVia: "direct", aisle: "books_print" },
    "framed-family-tree-print": { skills: ["printing", "framing"], shipVia: "direct", aisle: "wall_art" },
    "reunion-tshirt": { skills: ["apparel"], shipVia: "direct", aisle: "events_merch" },
    "reunion-name-badges": { skills: ["printing"], shipVia: "direct", aisle: "events_merch" },
    "reunion-banner": { skills: ["printing"], shipVia: "direct", aisle: "events_merch" },
    "wedding-family-tree": { skills: ["wood_engraving"], shipVia: "via_us", aisle: "events_merch" },
    "wedding-tree-poster": { skills: ["printing"], shipVia: "direct", aisle: "events_merch" },
    "wedding-tree-framed": { skills: ["printing", "framing"], shipVia: "direct", aisle: "events_merch" },
    "memorial-tree-poster": { skills: ["printing"], shipVia: "direct", aisle: "books_print" },
    "memorial-tree-framed": { skills: ["printing", "framing"], shipVia: "direct", aisle: "wall_art" },
    "memorial-wood-tree": { skills: ["wood_engraving"], shipVia: "via_us", aisle: "wall_art" },
    "desk-family-tree": { skills: ["wood_engraving"], shipVia: "via_us", aisle: "wall_art" },
  };
  for (const p of products) {
    const r = route[p.slug]!;
    await db.product.upsert({ where: { slug: p.slug }, create: { ...p, ...r }, update: {} });
    await db.product.updateMany({ where: { slug: p.slug, skills: { isEmpty: true } }, data: { skills: r.skills, shipVia: r.shipVia } });
    await db.product.updateMany({ where: { slug: p.slug, aisle: "" }, data: { aisle: r.aisle } });
  }
}

export async function seedPaymentSettings(db: PrismaClient): Promise<void> {
  // Manual-verification collection details. Editable later in Admin → Settings.
  const collection = {
    provider: "manual_mpesa" as const,
    verificationMode: "MANUAL" as const,
    businessName: "Leitor Investment Company Limited",
    paybillNumber: "522522",
    accountRef: "1320390277",
    instructions:
      "Pay the EXACT amount, then paste your M-Pesa / transaction code below.\n\n" +
      "• M-Pesa Paybill: 522522, Account: 1320390277 (Leitor Investment Company Limited)\n" +
      "• Bank transfer: KCB, Lowdar branch, Account 1320390277, Name Leitor Investment Company Limited\n\n" +
      "Your download or Family plan is released only after we confirm the payment — usually within a few hours.",
    config: {
      bankTransfer: {
        bank: "Kenya Commercial Bank",
        branch: "Lowdar",
        accountNo: "1320390277",
        accountName: "Leitor Investment Company Limited",
      },
    },
  };

  await db.paymentSettings.upsert({
    where: { scope: "global" },
    // keep the row's prices / other tweaks, but always refresh where money goes
    update: collection,
    create: {
      scope: "global",
      currency: "KES",
      defaultPriceKes: 750,
      ...collection,
    },
  });

  for (const kind of Object.values(GenerationKind)) {
    await db.generationPricing.upsert({
      where: { kind },
      update: {},
      create: { kind, baseKes: kind === GenerationKind.FAMILY_BOOK ? 1500 : 750 },
    });
  }
  console.log("Seed: PaymentSettings + GenerationPricing ready.");
}

export async function seedKenyaLocations(db: PrismaClient): Promise<void> {
  const existing = await db.kenyaLocation.count();
  if (existing > 0) {
    console.log(`Seed: KenyaLocation already has ${existing} rows.`);
    return;
  }
  const rows = KENYA_LOCATION_ROWS.flatMap((r) => {
    const out: { region: string; county: string; subcounty: string | null; ward: string | null; path: string }[] = [
      { region: r.region, county: r.county, subcounty: null, ward: null, path: r.county },
      { region: r.region, county: r.county, subcounty: r.subcounty, ward: null, path: `${r.county} > ${r.subcounty}` },
    ];
    for (const w of r.wards) {
      out.push({
        region: r.region,
        county: r.county,
        subcounty: r.subcounty,
        ward: w,
        path: `${r.county} > ${r.subcounty} > ${w}`,
      });
    }
    return out;
  });
  // dedupe county-level rows
  const seen = new Set<string>();
  const data = rows.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
  await db.kenyaLocation.createMany({ data, skipDuplicates: true });
  console.log(`Seed: KenyaLocation loaded ${data.length} units across all 47 counties.`);
}

export async function seedReferenceClans(db: PrismaClient): Promise<void> {
  const existing = await db.referenceClan.count();
  if (existing > 0) {
    console.log(`Seed: ReferenceClan already has ${existing} rows.`);
    return;
  }
  await db.referenceClan.createMany({
    data: REFERENCE_CLAN_ROWS.map((e) => ({
      community: e.community,
      name: e.name,
      normalized: normalizeClan(e.name),
      aka: e.aka ?? null,
      totem: e.totem ?? null,
      region: e.region ?? null,
      notes: e.notes ?? null,
      source: "reference-starter",
    })),
    skipDuplicates: true,
  });
  console.log(`Seed: ReferenceClan loaded ${REFERENCE_CLAN_ROWS.length} entries.`);
}

/** Bootstrap a platform super-admin and print a one-time sign-in link. */
export async function bootstrapAdmin(db: PrismaClient): Promise<void> {
  const email = (
    process.env.SUPERADMIN_EMAIL ||
    (process.env.ADMIN_EMAILS || "").split(",")[0] ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    console.log("Seed: no SUPERADMIN_EMAIL / ADMIN_EMAILS set — skipping admin bootstrap.");
    return;
  }
  const name = process.env.SUPERADMIN_NAME?.trim() || "Super Admin";

  const user = await db.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true },
    create: { email, name, isPlatformAdmin: true },
  });

  let hasPassword = Boolean(user.passwordHash);
  const pw = process.env.SUPERADMIN_PASSWORD?.trim();
  if (pw) {
    const problem = passwordProblem(pw);
    if (problem) {
      console.log(`Seed: SUPERADMIN_PASSWORD rejected — ${problem}.`);
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(pw) },
      });
      hasPassword = true;
      console.log(`Seed: password sign-in enabled for ${email} (use /login).`);
    }
  }

  const ownerMembership = await db.membership.findFirst({
    where: { userId: user.id, role: "OWNER" },
    select: { id: true },
  });
  if (!ownerMembership) {
    await db.workspace.create({
      data: {
        name: `${name}'s Family`,
        slug: `admin-${rand(6)}`,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }

  // With a password set there's no need for a link. Otherwise mint one, but
  // reuse an existing unused/unexpired token so redeploys don't pile them up.
  if (hasPassword) {
    console.log(`Seed: admin ${email} ready — sign in with your password at ${resolveOrigin()}/login`);
    return;
  }

  let tokenRow = await db.loginToken.findFirst({
    where: { userId: user.id, purpose: "bootstrap", usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (!tokenRow) {
    tokenRow = await db.loginToken.create({
      data: {
        token: randomBytes(24).toString("hex"),
        userId: user.id,
        purpose: "bootstrap",
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
      select: { token: true },
    });
  }

  const base = resolveOrigin();
  const path = `/api/auth/link/${tokenRow.token}`;
  console.log("\n============================================================");
  console.log(`SUPER-ADMIN SIGN-IN LINK for ${email}`);
  console.log("(single use, valid 7 days — open it in a browser):");
  console.log(`  ${base}${path}`);
  if (base === "https://YOUR-DOMAIN") {
    console.log("  (host unknown — replace YOUR-DOMAIN with your real domain)");
  }
  console.log("  Tip: set SUPERADMIN_PASSWORD to sign in with email + password instead.");
  console.log("============================================================\n");
}
