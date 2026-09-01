import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
