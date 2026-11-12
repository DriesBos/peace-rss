#!/usr/bin/env bash
# Start backing services in Docker, then run Next.js on the host with hot reload.
#   pnpm dev        -> http://localhost:3000
#   pnpm dev:https  -> https://localhost:3000 (self-signed cert)
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start OrbStack (or Docker Desktop) and try again." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing .env at repo root (docker compose reads it). Symlink it: ln -s .env.local .env" >&2
  exit 1
fi

if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend dependencies..."
  pnpm --dir frontend install
fi

# Auth and the URLs below all assume port 3000, so don't let Next fall back.
if pid=$(lsof -ti tcp:3000 -sTCP:LISTEN 2>/dev/null | head -1) && [ -n "$pid" ]; then
  echo "Port 3000 is in use by: $(ps -p "$pid" -o pid=,command= | cut -c1-120)" >&2
  echo "Stop it (kill $pid) and run pnpm dev again." >&2
  exit 1
fi

echo "Starting postgres, miniflux..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  up -d --wait postgres miniflux

# The env files point at the Docker hostname (miniflux:8080).
# Process env wins over Next's .env files, so override them with host URLs here.
export MINIFLUX_BASE_URL="http://localhost:8080/miniflux"
# Reader tables (mirrored posts + tags) and the auth database live in the Docker Postgres, published on 5433.
env_value() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//' || true; }
export READER_DATABASE_URL="postgres://$(env_value POSTGRES_USER):$(env_value POSTGRES_PASSWORD)@localhost:5433/$(env_value POSTGRES_DB)?sslmode=disable"
AUTH_DB="$(env_value AUTH_POSTGRES_DB)"
export AUTH_DATABASE_URL="postgres://$(env_value POSTGRES_USER):$(env_value POSTGRES_PASSWORD)@localhost:5433/${AUTH_DB:-komorebi_auth}?sslmode=disable"
if [ "${1:-}" = "--https" ]; then
  export BETTER_AUTH_URL="https://localhost:3000"
else
  export BETTER_AUTH_URL="http://localhost:3000"
fi

echo "Miniflux: http://localhost:8080/miniflux/"
if [ "${1:-}" = "--https" ]; then
  exec pnpm --dir frontend exec next dev --experimental-https --port 3000
else
  exec pnpm --dir frontend exec next dev --port 3000
fi
