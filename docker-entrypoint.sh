#!/bin/sh
set -e

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

  # Seed is idempotent (upserts). Runs every deploy so there are no manual
  # terminal steps; set SKIP_SEED=true to opt out.
  if [ "${SKIP_SEED:-false}" != "true" ]; then
    echo "==> seed"
    npx tsx prisma/seed.ts || echo "seed failed (continuing)"
  fi
fi

exec "$@"
