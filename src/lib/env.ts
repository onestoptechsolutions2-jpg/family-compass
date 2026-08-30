import { z } from "zod";

/**
 * Validated process environment. Import from server code only.
 * Throws at boot if a required variable is missing/malformed.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (openssl rand -base64 33)"),
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  EMAIL_SERVER: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("Family Compass <no-reply@localhost>"),

  ADMIN_EMAILS: z
    .string()
    .optional()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

export const hasGoogleOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const hasEmailProvider = Boolean(env.EMAIL_SERVER);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.ADMIN_EMAILS.includes(email.toLowerCase());
}
