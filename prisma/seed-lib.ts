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
