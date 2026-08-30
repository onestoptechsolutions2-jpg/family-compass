#!/bin/sh
set -e

# The `app` service runs migrations on boot (RUN_MIGRATIONS defaults to true).
# Set RUN_MIGRATIONS=false on the `worker` service so the two containers don't
# race each other applying migrations.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> prisma migrate deploy"
  npx prisma migrate deploy
fi

exec "$@"
