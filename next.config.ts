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
  experimental: {
    // Server Actions handle media uploads; raise the body limit.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
