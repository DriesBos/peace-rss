#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/peace-rss}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-12}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-5}"

if [ ! -d "${PROJECT_DIR}" ]; then
  echo "Project directory not found: ${PROJECT_DIR}" >&2
  exit 1
fi

cd "${PROJECT_DIR}"

if [ ! -d .git ]; then
  echo "Not a git checkout: ${PROJECT_DIR}" >&2
  exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Compose file not found: ${PROJECT_DIR}/${COMPOSE_FILE}" >&2
  exit 1
fi

echo "Fetching latest refs from ${GIT_REMOTE}..."
git fetch --prune "${GIT_REMOTE}"

echo "Checking out ${DEPLOY_REF}..."
git checkout --detach "${DEPLOY_REF}"

echo "Validating Docker Compose configuration..."
docker compose -f "${COMPOSE_FILE}" config >/dev/null

echo "Pulling base images..."
docker compose -f "${COMPOSE_FILE}" pull

echo "Starting updated services..."
docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

echo "Current service status:"
docker compose -f "${COMPOSE_FILE}" ps

if [ -n "${HEALTHCHECK_URL}" ]; then
  echo "Running health check: ${HEALTHCHECK_URL}"

  for attempt in $(seq 1 "${HEALTHCHECK_RETRIES}"); do
    if curl -4 -fsS "${HEALTHCHECK_URL}" >/dev/null; then
      echo "Health check passed on attempt ${attempt}."
      exit 0
    fi

    if [ "${attempt}" -lt "${HEALTHCHECK_RETRIES}" ]; then
      sleep "${HEALTHCHECK_INTERVAL}"
    fi
  done

  echo "Health check failed after ${HEALTHCHECK_RETRIES} attempts." >&2
  exit 1
fi

echo "Deploy completed."
