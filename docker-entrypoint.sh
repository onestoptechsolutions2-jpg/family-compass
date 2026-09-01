#!/bin/sh
set -e

# Derive DATABASE_URL from the bundled postgres service when it isn't set
# explicitly — POSTGRES_PASSWORD is the only value the operator must provide
# (the postgres container needs it too). Keeps `prisma migrate deploy` and the
# seed working with a minimal env.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export DATABASE_URL="postgresql://${POSTGRES_USER:-familycompass}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-postgres}:5432/${POSTGRES_DB:-familycompass}?schema=public"
  echo "==> DATABASE_URL derived from POSTGRES_* (host ${POSTGRES_HOST:-postgres})"
fi

# The `app` service runs migrations on boot (RUN_MIGRATIONS defaults to true).
# Set RUN_MIGRATIONS=false on the `worker` service so the two containers don't
# race each other applying migrations.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> prisma migrate deploy"
  if ! npx prisma migrate deploy; then
    echo "==> migrate deploy failed — marking any failed migrations rolled back and retrying once"
    for dir in prisma/migrations/*/; do
      name=$(basename "$dir")
      [ "$name" = "*" ] && continue
      npx prisma migrate resolve --rolled-back "$name" 2>/dev/null || true
    done
    npx prisma migrate deploy
  fi
  echo "==> migrations up to date"

  # Seed is idempotent (upserts). Run it in the BACKGROUND so a slow seed can
  # never delay the app from binding its port and passing health checks.
  # Set SKIP_SEED=true to opt out.
  if [ "${SKIP_SEED:-false}" != "true" ]; then
    (
      echo "==> seed (background)"
      npx tsx prisma/seed.ts && echo "==> seed done" || echo "==> seed failed (continuing)"
    ) &
  fi
fi

exec "$@"
