import { z } from "zod";

/**
 * Validated process environment. Import from server code only.
 * Throws at boot if a required variable is missing/malformed.
 *
 * Nothing here has an environment-specific default — public origin, database
 * and secrets must all be supplied by the deployment. The only baked values
 * are throwaway placeholders used during `next build` (see below).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (openssl rand -base64 33)"),
  AUTH_URL: z.string().url().optional(),
  // Public origin of the app, e.g. https://myroots.example.com — used to build
  // share links and payment references.
  APP_URL: z.string().url(),
  // Optional override for links a person receives (share pages, memorials,
  // invites, WhatsApp sign-in). Set this when the browsing origin differs from
  // the canonical public origin, or when developing locally but sharing real
  // links. Falls back to the live request host, then APP_URL.
  SHARE_ORIGIN: z.string().url().optional().default(""),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  EMAIL_SERVER: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default(""),

  // --- M-Pesa Daraja (STK Push) ---------------------------------------
  // All optional: the Daraja provider stays dormant until these are set and
  // PaymentSettings.provider is switched to "mpesa_daraja".
  MPESA_ENV: z
    .string()
    .optional()
    .transform((v) => (v === "production" ? "production" : "sandbox")),
  MPESA_CONSUMER_KEY: z.string().optional().default(""),
  MPESA_CONSUMER_SECRET: z.string().optional().default(""),
  MPESA_SHORTCODE: z.string().optional().default(""),
  MPESA_PASSKEY: z.string().optional().default(""),
  MPESA_TRANSACTION_TYPE: z
    .string()
    .optional()
    .transform((v) => (v === "CustomerPayBillOnline" ? "CustomerPayBillOnline" : "CustomerBuyGoodsOnline")),

  ADMIN_EMAILS: z
    .string()
    .optional()
    .default("")
    .transform(csvLower),

  // --- who may sign in ---------------------------------------------------
  // Access is invite-only by default: only admins, people already in the
  // system, people with a pending invitation, or addresses on the allow
  // lists below can sign in. There is no in-app self-service registration.
  // Set OPEN_SIGNUP=true to let anyone sign in (and self-provision).
  OPEN_SIGNUP: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  ALLOWED_SIGNUP_EMAILS: z.string().optional().default("").transform(csvLower),
  ALLOWED_SIGNUP_DOMAINS: z
    .string()
    .optional()
    .default("")
    .transform((v) => csvLower(v).map((d) => d.replace(/^@/, ""))),
});

function csvLower(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// During `next build` (no database, no secrets, no real origin) we don't want a
// hard failure — pages are compiled, not run. Runtime validation is unchanged.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const BUILD_FALLBACKS = {
  DATABASE_URL: "postgresql://build:build@localhost:5432/build?schema=public",
  AUTH_SECRET: "build-time-placeholder-secret",
  APP_URL: "http://localhost",
} as const;

const source = isBuildPhase ? { ...BUILD_FALLBACKS, ...process.env } : process.env;

const parsed = schema.safeParse(source);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  if (!isBuildPhase) throw new Error("Invalid environment variables");
}

export const env = (parsed.success ? parsed.data : schema.parse(BUILD_FALLBACKS)) as z.infer<
  typeof schema
>;

export const hasGoogleOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const hasEmailProvider = Boolean(env.EMAIL_SERVER && env.EMAIL_FROM);
export const hasDaraja = Boolean(
  env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY,
);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.ADMIN_EMAILS.includes(email.toLowerCase());
}
