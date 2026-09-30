import { PartnerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { env, hasEmailProvider, hasGoogleOAuth } from "@/lib/env";
import { getPaymentSettings } from "@/lib/payments";
import { skillLabel } from "@/lib/jobs";

export type Check = {
  id: string;
  label: string;
  ok: boolean;
  /** what a public customer needs; a test order by you may not */
  forCustomers: boolean;
  /** what your own test order needs */
  forTestOrder: boolean;
  detail: string;
  fix: string;
};

export type LaunchState = {
  appUrl: string;
  openSignup: boolean;
  googleConfigured: boolean;
  emailConfigured: boolean;
  adminCount: number;
  payment: { paybill: boolean; till: boolean; bank: boolean; instructions: boolean };
  receivingAddress: boolean;
  /** false while the price is still the placeholder it was seeded with */
  products: { name: string; active: boolean; priceKes: number; skills: string[]; shipVia: string; priceReviewed: boolean }[];
  /** the specialities at least one active partner has */
  partnerSkills: string[];
  ordersPlaced: number;
};

const list = (xs: string[]) => (xs.length ? xs.join(", ") : "none");

/** The verdict, from facts alone, so it can be tested without a database. */
export function evaluate(s: LaunchState): { checks: Check[]; readyForTestOrder: boolean; readyForCustomers: boolean } {
  const on = s.products.filter((p) => p.active);
  const guessed = on.filter((p) => !p.priceReviewed);
  const uncovered = [...new Set(on.flatMap((p) => p.skills))].filter((k) => !s.partnerSkills.includes(k));
  const needsAddress = on.some((p) => p.shipVia === "via_us");
  const host = (() => {
    try {
      return new URL(s.appUrl).hostname;
    } catch {
      return "";
    }
  })();
  const publicAddress = s.appUrl.startsWith("https://") && !!host && !/^(localhost|127\.|0\.0\.0\.0)/.test(host);

  const checks: Check[] = [
    {
      id: "sign-in",
      label: "Customers can sign in",
      ok: s.openSignup && s.googleConfigured,
      forCustomers: true,
      forTestOrder: false,
      detail: `Open sign-up is ${s.openSignup ? "on" : "OFF"}; Google sign-in is ${s.googleConfigured ? "set up" : "NOT set up"}.`,
      fix: "Set OPEN_SIGNUP=true, and GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (redirect URI: your site address + /api/auth/callback/google), then redeploy. Until then only admins can sign in.",
    },
    {
      id: "public-address",
      label: "The site address is public and secure",
      ok: publicAddress,
      forCustomers: true,
      forTestOrder: true,
      detail: `The site thinks it is at ${s.appUrl}. Every QR code is printed with this address.`,
      fix: "Set APP_URL to your real https address. A QR printed with the wrong address never works again.",
    },
    {
      id: "admin",
      label: "There is an admin who can verify payments",
      ok: s.adminCount > 0,
      forCustomers: true,
      forTestOrder: true,
      detail: `${s.adminCount} admin${s.adminCount === 1 ? "" : "s"}.`,
      fix: "Set ADMIN_EMAILS, sign in with that address, or run the admin:link script.",
    },
    {
      id: "payment-details",
      label: "Customers are told where to pay",
      ok: s.payment.paybill || s.payment.till || s.payment.bank,
      forCustomers: true,
      forTestOrder: true,
      detail: `Paybill ${s.payment.paybill ? "set" : "not set"}, till ${s.payment.till ? "set" : "not set"}, bank ${s.payment.bank ? "set" : "not set"}.`,
      fix: "Admin > Settings: enter your paybill or till (and account reference) or bank details.",
    },
    {
      id: "product-on-sale",
      label: "At least one product is on sale",
      ok: on.length > 0,
      forCustomers: true,
      forTestOrder: true,
      detail: on.length ? `On sale: ${list(on.map((p) => p.name))}.` : "Nothing is on sale.",
      fix: "Admin > Products: tick \"On sale\" for a product once its price is right.",
    },
    {
      id: "prices-reviewed",
      label: "Every product on sale has a price you set",
      ok: on.length > 0 && guessed.length === 0,
      forCustomers: true,
      forTestOrder: false,
      detail: guessed.length
        ? `Still the placeholder price I guessed: ${list(guessed.map((p) => `${p.name} (KES ${p.priceKes.toLocaleString()})`))}.`
        : "Every product on sale has had its price saved by an admin.",
      fix: "Get a real quote from your supplier, then Admin > Products: enter the price and Save (even if it equals the current one, saving marks it as reviewed).",
    },
    {
      id: "partners",
      label: "Someone can make every product on sale",
      ok: on.length > 0 && uncovered.length === 0,
      forCustomers: true,
      forTestOrder: false,
      detail: uncovered.length
        ? `No active partner does: ${list(uncovered.map(skillLabel))}. A customer could pay and wait.`
        : "Every speciality your products need has an active partner.",
      fix: "Admin > Partners: invite a partner with the missing speciality, or switch the product off.",
    },
    {
      id: "receiving-address",
      label: "Partners know where to send pieces we check first",
      ok: !needsAddress || s.receivingAddress,
      forCustomers: true,
      forTestOrder: false,
      detail: needsAddress ? (s.receivingAddress ? "Address is set." : "Some products come to you first, and no address is set.") : "No product on sale needs it.",
      fix: "Admin > Settings: fill in \"Where partners send finished pieces\".",
    },
    {
      id: "email",
      label: "Customers get email updates",
      ok: s.emailConfigured,
      forCustomers: false,
      forTestOrder: false,
      detail: s.emailConfigured ? "Email is set up." : "Not set up: customers still see updates in the app, but no email is sent.",
      fix: "Set EMAIL_SERVER and EMAIL_FROM. Recommended, not required.",
    },
    {
      id: "first-order",
      label: "You have placed a test order yourself",
      ok: s.ordersPlaced > 0,
      forCustomers: false,
      forTestOrder: false,
      detail: `${s.ordersPlaced} order${s.ordersPlaced === 1 ? "" : "s"} placed so far.`,
      fix: "Follow docs/commerce/FIRST-ORDER.md from your admin account.",
    },
  ];
  return {
    checks,
    readyForTestOrder: checks.filter((c) => c.forTestOrder).every((c) => c.ok),
    readyForCustomers: checks.filter((c) => c.forCustomers).every((c) => c.ok),
  };
}

export async function loadLaunchState(): Promise<LaunchState> {
  const [products, partners, admins, orders, settings] = await Promise.all([
    db.product.findMany({ select: { name: true, active: true, basePriceKes: true, skills: true, shipVia: true, priceReviewedAt: true } }),
    db.partner.findMany({ where: { status: PartnerStatus.ACTIVE }, select: { skills: true } }),
    db.user.count({ where: { isPlatformAdmin: true } }),
    db.order.count({ where: { status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    getPaymentSettings(),
  ]);
  return {
    appUrl: env.APP_URL,
    openSignup: env.OPEN_SIGNUP,
    googleConfigured: hasGoogleOAuth,
    emailConfigured: hasEmailProvider,
    adminCount: admins,
    payment: {
      paybill: Boolean(settings.paybillNumber),
      till: Boolean(settings.tillNumber),
      bank: Boolean(settings.bankTransfer),
      instructions: Boolean(settings.instructions),
    },
    receivingAddress: Boolean(settings.receivingAddress),
    products: products.map((p) => ({
      name: p.name,
      active: p.active,
      priceKes: p.basePriceKes,
      skills: p.skills,
      shipVia: p.shipVia,
      priceReviewed: p.priceReviewedAt !== null,
    })),
    partnerSkills: [...new Set(partners.flatMap((p) => p.skills))],
    ordersPlaced: orders,
  };
}
