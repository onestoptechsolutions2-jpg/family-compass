#!/bin/sh
set -e

# The `app` service runs migrations on boot (RUN_MIGRATIONS defaults to true).
# Set RUN_MIGRATIONS=false on the `worker` service so the two containers don't
# race each other applying migrations.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> prisma migrate deploy"
  npx prisma migrate deploy

  if [ "${RUN_SEED_ON_MIGRATE:-false}" = "true" ]; then
    echo "==> prisma db seed"
    npx tsx prisma/seed.ts || echo "seed failed (continuing)"
  fi
fi

exec "$@"
