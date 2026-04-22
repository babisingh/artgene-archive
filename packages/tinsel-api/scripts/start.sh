#!/bin/sh
# Startup script for Railway (and any container runtime).
# Runs Alembic migrations then starts the API server.
# Railway injects $PORT automatically; defaults to 8000 for local Docker runs.
set -e

echo "=== ArtGene Archive / TINSEL API ==="
echo "Environment : ${SENTINEL_ENV:-development}"
echo "Port        : ${PORT:-8000}"

echo ""
echo "--- Running database migrations ---"
cd /app/packages/tinsel-api
alembic upgrade head
echo "--- Migrations complete ---"
echo ""

if [ "${SENTINEL_ENV:-development}" = "development" ]; then
    echo "--- Seeding development database ---"
    python /app/packages/tinsel-api/scripts/seed_dev.py || true
    echo ""
fi

echo "--- Starting API server ---"
exec uvicorn sentinel_api.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --log-level "${LOG_LEVEL:-info}"
