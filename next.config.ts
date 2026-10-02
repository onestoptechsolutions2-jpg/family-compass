import path from "node:path";
import type { NextConfig } from "next";

/**
 * Headers every response carries. The app loads nothing from other sites (no CDN scripts, fonts,
 * analytics or embeds), so the policy can be strict: pages may only load from themselves.
 * Inline scripts and styles stay allowed because Next renders its own bootstrap that way.
 */
const isProd = process.env.NODE_ENV === "production";
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Pin the workspace root — a stray lockfile in a parent directory otherwise
  // confuses Turbopack's root detection.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // A full build + `next start` (not `output: "standalone"`) keeps the same
  // node_modules available to both the web server and the pg-boss worker
  // process, which share code under src/lib. Revisit standalone later as an
  // image-size optimization.
  serverExternalPackages: ["pg-boss", "sharp", "@resvg/resvg-js"],
  // Stamp the build with the commit it was built from (Coolify sets
  // SOURCE_COMMIT at build time) so /api/health can report what's live.
  env: {
    APP_BUILD_SHA:
      process.env.SOURCE_COMMIT ??
      process.env.APP_BUILD_SHA ??
      process.env.GIT_SHA ??
      "unknown",
  },
  experimental: {
    // Server Actions handle media uploads; raise the body limit.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
