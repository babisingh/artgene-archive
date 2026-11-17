#!/bin/bash
# One-command bring-up for the ArtGene Archive (API + dashboard + Postgres) on localhost:3111.
# Usage: ./dev-up.sh [--rebuild] [--seed]
#
# --rebuild: force Docker rebuild (run when you've changed code).
# --seed: seed a development API key (run on first startup or after `docker compose down -v`).
set -e

RESET=""
SEED=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --rebuild) RESET="--build"; shift ;;
    --seed) SEED=1; shift ;;
    *) echo "unknown arg: $1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")"

# The host port the API is published on. Override when something else already
# holds 8000: API_PORT=8001 ./dev-up.sh
API_PORT="${API_PORT:-8000}"
export API_PORT
echo "ArtGene Archive / TINSEL — dev up"
echo "cwd: $(pwd)"

echo ""
echo "--- Starting services (Postgres, API, dashboard) ---"
# SENTINEL_ENV=development tells the API to run seed_dev if the org doesn't exist.
# If you lose the key, run: docker compose down -v && ./dev-up.sh --seed
export SENTINEL_ENV="development"
docker compose up $RESET -d postgres api dashboard

echo ""
echo "--- Waiting for services to be ready ---"
timeout=60
while [ $timeout -gt 0 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/api/v1/health" 2>/dev/null || echo 999)
  if [ "$code" = "200" ]; then
    echo "  API is ready (health: 200)"
    break
  fi
  echo "  Waiting for API... (got $code, retrying)"
  sleep 2
  timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
  echo "ERROR: API did not come up within 60 seconds."
  echo "  Check logs with: docker compose logs api"
  exit 1
fi

echo ""
echo "--- Waiting for dashboard ---"
timeout=30
while [ $timeout -gt 0 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null || echo 999)
  if [ "$code" = "200" ]; then
    echo "  Dashboard is ready (web: 200)"
    break
  fi
  echo "  Waiting for dashboard (got $code, retrying)..."
  sleep 2
  timeout=$((timeout - 2))
done

echo ""
echo "✓ Services are ready."
echo ""
echo "  API:       http://127.0.0.1:${API_PORT}  (see /api/v1/health, /api/v1/catalogue; set API_PORT to move it)"
echo "  Dashboard: http://127.0.0.1:3000  (direct; set DASHBOARD_PORT=3111 for 3111)"
echo "  Postgres:  localhost:5432         (image: supabase/postgres:15, pass: tinsel_local_password)"
echo ""
echo "  Container logs:"
echo "    docker compose logs -f api"
echo "    docker compose logs -f dashboard"
echo "    docker compose logs -f postgres"
echo ""
echo "  Stop: docker compose down"
echo "  Stop and clear database: docker compose down -v"
echo ""
echo "  Your dev API key is printed on first API startup."
echo "  Paste it in the dashboard under Settings > API Key."
