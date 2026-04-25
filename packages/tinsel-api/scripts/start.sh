#!/bin/sh
# Startup script for Railway (and any container runtime).
# Runs Alembic migrations then starts the API server.
# Railway injects $PORT automatically; defaults to 8000 for local Docker runs.
set -e

echo "=== ArtGene Archive / TINSEL API ==="
echo "Environment : ${SENTINEL_ENV:-development}"
echo "Port        : ${PORT:-8000}"

echo ""
echo "--- Waiting for database to be ready ---"
cd /app/packages/tinsel-api
# Retry up to 10 times (covers Railway Postgres cold-start delay ~20-30 s).
DB_RETRIES=0
until python - <<'PYEOF'
import os, sys
try:
    import asyncio, asyncpg
    url = os.environ.get("DATABASE_URL", "")
    # Normalise postgres:// → postgresql+asyncpg:// for asyncpg's connect()
    url = url.replace("postgresql://", "").replace("postgres://", "")
    # url is now user:pass@host:port/db
    asyncio.run(asyncpg.connect("postgresql://" + url))
    sys.exit(0)
except Exception as e:
    print(f"  DB not ready: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
do
    DB_RETRIES=$((DB_RETRIES + 1))
    if [ "$DB_RETRIES" -ge 10 ]; then
        echo "ERROR: Database not reachable after 10 attempts."
        echo "  Check that DATABASE_URL is set and the Postgres plugin is linked"
        echo "  to this service in the Railway dashboard."
        echo "  Current DATABASE_URL prefix: $(echo "${DATABASE_URL:-<not set>}" | cut -c1-40)..."
        exit 1
    fi
    echo "  Attempt $DB_RETRIES/10 — retrying in 5 s..."
    sleep 5
done
echo "--- Database is ready ---"

echo ""
echo "--- Running database migrations ---"
alembic upgrade head
echo "--- Migrations complete ---"
echo ""

if [ "${SENTINEL_ENV:-development}" = "development" ]; then
    echo "--- Seeding development database ---"
    python /app/packages/tinsel-api/scripts/seed_dev.py || true
    echo ""
else
    echo "--- Seeding production database (idempotent) ---"
    python /app/packages/tinsel-api/scripts/seed_prod.py || true
    echo ""
fi

echo "--- Starting API server ---"
exec uvicorn sentinel_api.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --log-level "${LOG_LEVEL:-info}"
