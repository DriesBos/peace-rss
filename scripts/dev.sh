#!/usr/bin/env bash
# Start backing services in Docker, then run Next.js on the host with hot reload.
#   pnpm dev        -> https://localhost:3000 (self-signed cert)
#   pnpm dev:http   -> http://localhost:3000  (needed for social feeds, see docs)
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

echo "Starting postgres, miniflux, rss-bridge..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  up -d --wait postgres miniflux rss-bridge

# The env files point at Docker hostnames (miniflux:8080, rss-bridge, frontend:3000).
# Process env wins over Next's .env files, so override them with host URLs here.
export MINIFLUX_BASE_URL="http://localhost:8080/miniflux"
export RSS_BRIDGE_BASE_URL="http://localhost:3001"
# Miniflux (in Docker) fetches social feeds back from Next.js on the host.
export SOCIAL_FEEDS_BASE_URL="http://host.docker.internal:3000"

echo "Miniflux: http://localhost:8080/miniflux/"
if [ "${1:-}" = "--http" ]; then
  exec pnpm --dir frontend exec next dev
else
  exec pnpm --dir frontend dev
fi
