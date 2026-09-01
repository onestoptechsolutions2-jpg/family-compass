import { createHash } from "node:crypto";

import { z } from "zod";

/**
 * Validated process environment. Import from server code only.
 * Throws at boot if a required variable is missing/malformed.
 *
 * Nothing here has an environment-specific default — public origin, database
 * and secrets must all be supplied by the deployment. The only baked values
 * are throwaway placeholders used during `next build` (see below).
 */
// A compose `${VAR:-}` on an unset variable hands us "" — treat it as absent.
const optionalUrl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().url().optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (openssl rand -base64 33)"),
  AUTH_URL: optionalUrl,
  // Public origin of the app, e.g. https://myroots.example.com — used to build
  // share links and payment references.
  APP_URL: z.string().url(),
  // Optional override for links a person receives (share pages, memorials,
  // invites, WhatsApp sign-in). Set this when the browsing origin differs from
  // the canonical public origin, or when developing locally but sharing real
  // links. Falls back to the live request host, then APP_URL.
  SHARE_ORIGIN: optionalUrl.transform((v) => v ?? ""),
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
  // The public "start your own tree from yourself" funnel at /start.
  // On by default; set SELF_START=false to hide it.
  SELF_START: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
  // The chama plugin — welfare funds on memorials + linking to an external
  // Chama-platform group. On by default; set CHAMA_ENABLED=false to remove
  // every chama surface (tab, memorial section, /give page).
  CHAMA_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
  // Alert platform admins when the database grows past this many GB.
  SYSTEM_DB_ALERT_GB: z
    .string()
    .optional()
    .default("5")
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 5;
    }),
  // --- Web Push (installed-app device notifications) --------------------
  // All optional: push stays disabled until a VAPID key pair is supplied.
  // Generate once with:  npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  // Contact URI for the push service (mailto: or https:). Falls back to a
  // mailto: built from the first ADMIN_EMAILS entry.
  VAPID_SUBJECT: z.string().optional().default(""),

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

const trimmed = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

/**
 * A compose stack ships its own postgres and the platform (Coolify) injects
 * the domain. Rather than making the operator hand-set five variables, derive
 * the ones we can when they're absent — the ONLY value that must be set is
 * POSTGRES_PASSWORD (the DB container needs it too).
 *
 *   DATABASE_URL  ← postgres://<POSTGRES_USER>:<POSTGRES_PASSWORD>@<host>/<db>
 *   APP_URL       ← COOLIFY_URL / https://COOLIFY_FQDN
 *   AUTH_URL      ← APP_URL
 *   AUTH_SECRET   ← stable hash of POSTGRES_PASSWORD (warns; set an explicit one)
 */
export let envSynthesized: string[] = [];

function deriveEnv(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const e: Record<string, string | undefined> = { ...raw };
  const pgPass = trimmed(e.POSTGRES_PASSWORD);
  const made: string[] = [];

  if (!trimmed(e.DATABASE_URL) && pgPass) {
    const u = trimmed(e.POSTGRES_USER) ?? "familycompass";
    const d = trimmed(e.POSTGRES_DB) ?? "familycompass";
    const h = trimmed(e.POSTGRES_HOST) ?? "postgres";
    e.DATABASE_URL = `postgresql://${u}:${encodeURIComponent(pgPass)}@${h}:5432/${d}?schema=public`;
    made.push("DATABASE_URL");
  }

  const coolifyOrigin =
    trimmed(e.COOLIFY_URL) ??
    (trimmed(e.COOLIFY_FQDN)
      ? `https://${trimmed(e.COOLIFY_FQDN)!.split(",")[0]!.trim()}`
      : undefined);
  if (!trimmed(e.APP_URL) && coolifyOrigin) {
    e.APP_URL = coolifyOrigin;
    made.push("APP_URL");
  }
  if (!trimmed(e.APP_URL)) {
    // Last resort so an origin-less service (e.g. the worker, which the
    // platform may not hand a domain to) can't crash on this alone. Public
    // links built from APP_URL will be wrong until it's set explicitly.
    e.APP_URL = `http://localhost:${trimmed(e.PORT) ?? "3000"}`;
    made.push("APP_URL(fallback — set APP_URL explicitly)");
  }
  if (!trimmed(e.AUTH_URL) && trimmed(e.APP_URL)) {
    e.AUTH_URL = trimmed(e.APP_URL);
    made.push("AUTH_URL");
  }

  if (!trimmed(e.AUTH_SECRET) && pgPass) {
    e.AUTH_SECRET = createHash("sha256").update(`familycompass:auth:${pgPass}`).digest("base64");
    made.push("AUTH_SECRET");
  }

  envSynthesized = made;
  return e;
}

const source = isBuildPhase
  ? { ...BUILD_FALLBACKS, ...process.env }
  : deriveEnv(process.env);

const parsed = schema.safeParse(source);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  if (!isBuildPhase) {
    console.error(
      "→ Set POSTGRES_PASSWORD (the postgres container needs it too). " +
        "DATABASE_URL, APP_URL, AUTH_URL and AUTH_SECRET are derived from it + the platform URL when unset.",
    );
    throw new Error("Invalid environment variables");
  }
} else if (envSynthesized.length > 0 && !isBuildPhase) {
  console.warn(`⚠ Derived ${envSynthesized.join(", ")} from POSTGRES_PASSWORD / platform URL.`);
  if (envSynthesized.includes("AUTH_SECRET")) {
    console.warn("⚠ Set an explicit AUTH_SECRET (openssl rand -base64 33) for a stable value.");
  }
}

export const env = (parsed.success ? parsed.data : schema.parse(BUILD_FALLBACKS)) as z.infer<
  typeof schema
>;

export const hasGoogleOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const hasEmailProvider = Boolean(env.EMAIL_SERVER && env.EMAIL_FROM);
export const hasDaraja = Boolean(
  env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY,
);

export const hasWebPush = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
export function vapidSubject(): string {
  if (env.VAPID_SUBJECT) return env.VAPID_SUBJECT;
  const admin = env.ADMIN_EMAILS[0];
  return admin ? `mailto:${admin}` : "mailto:notifications@familycompass.app";
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.ADMIN_EMAILS.includes(email.toLowerCase());
}
