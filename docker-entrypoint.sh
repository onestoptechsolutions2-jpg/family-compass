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

  if [ "${RUN_SEED_ON_MIGRATE:-false}" = "true" ]; then
    echo "==> prisma db seed"
    npx tsx prisma/seed.ts || echo "seed failed (continuing)"
  fi
fi

exec "$@"
