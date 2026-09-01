# syntax=docker/dockerfile:1

# ---------- base ----------
# Debian (glibc) rather than Alpine — sharp / @resvg/resvg-js / tailwind-oxide /
# unrs-resolver all ship glibc prebuilds and this avoids musl edge cases.
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    CI=true
# Match the npm that generated package-lock.json.
RUN npm install -g npm@11

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
# --ignore-scripts: skip postinstalls that need network (prisma engines) or
# trip on the build sandbox (napi-postinstall). Native deps still install their
# platform binary packages; `prisma generate` fetches its engine in the builder.
# Try the reproducible `npm ci`; if it fails, dump the npm log and fall back to
# `npm install` (repairs lockfile drift), dumping the log again on hard failure.
RUN set -eux; \
    ( npm ci --ignore-scripts ) \
 || ( echo "### npm ci failed — npm log follows ###"; tail -n 250 /root/.npm/_logs/*.log 2>/dev/null || true; \
      echo "### retrying with npm install ###"; \
      npm install --ignore-scripts ) \
 || ( echo "### npm install also failed — npm log follows ###"; tail -n 250 /root/.npm/_logs/*.log 2>/dev/null || true; \
      exit 1 )

# ---------- builder ----------
FROM base AS builder
# Commit the image is built from — Coolify provides SOURCE_COMMIT at build.
# next.config.ts reads APP_BUILD_SHA and inlines it so /api/health can report
# what's live. Falls back to "unknown" when built outside Coolify.
ARG SOURCE_COMMIT
ENV APP_BUILD_SHA=$SOURCE_COMMIT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` (downloads the engine here) + `next build`.
RUN npm run build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/seed ./seed
# `npm start` runs the `prestart` hook (scripts/prestart.mjs) — a migration
# safety net for when the platform overrides the container ENTRYPOINT.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3000

# Give the boot sequence (prisma migrate deploy) room before failures count,
# so a slow first deploy isn't killed and restarted mid-migration. The seed
# runs in the background and never blocks readiness.
HEALTHCHECK --interval=30s --timeout=10s --start-period=150s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
# Overridden to `npm run worker` for the worker service in docker-compose.
CMD ["npm", "run", "start"]
