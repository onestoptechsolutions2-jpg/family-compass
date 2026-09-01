import { z } from "zod";

/**
 * Validated process environment. Import from server code only.
 *
 * Missing/invalid required vars no longer throw here — under an orchestrator
 * with `restart: unless-stopped` that only produces an invisible crash loop.
 * Instead we log loudly, boot DEGRADED with placeholders, and let
 * `/api/health` report which vars are absent so it's diagnosable.
 *
 * Nothing here has an environment-specific default — public origin, database
 * and secrets must all be supplied by the deployment. The only baked values
 * are throwaway placeholders used during `next build` and degraded boot.
 */

// An optional URL that also accepts "" (a compose `${VAR:-}` on an unset var
// hands us an empty string, not `undefined`).
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

const source = isBuildPhase ? { ...BUILD_FALLBACKS, ...process.env } : process.env;

const parsed = schema.safeParse(source);

/**
 * True when required runtime vars are missing/invalid. We used to `throw` here,
 * but under an orchestrator with `restart: unless-stopped` that just produces
 * an invisible crash loop. Instead: log loudly, boot in a degraded state, and
 * let `/api/health` report which vars are absent (`env` booleans) so the
 * misconfiguration is diagnosable. DB-backed pages already fail soft.
 */
export const envInvalid = !parsed.success && !isBuildPhase;

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables — booting DEGRADED. Set these as RUNTIME vars:",
    z.treeifyError(parsed.error),
  );
}

// Degraded fallback: fill only the *empty/missing* required keys with
// placeholders so schema.parse can't throw. Real values from process.env win.
function degradedSource(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...process.env } as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(BUILD_FALLBACKS)) {
    if (!out[k] || out[k] === "") out[k] = v;
  }
  return out;
}

function resolveEnv(): z.infer<typeof schema> {
  if (parsed.success) return parsed.data;
  try {
    return schema.parse(degradedSource());
  } catch {
    // Last resort — the 3 hard-required keys plus schema defaults. Never throws.
    return schema.parse(BUILD_FALLBACKS);
  }
}

export const env = resolveEnv();

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
