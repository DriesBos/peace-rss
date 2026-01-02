#!/usr/bin/env bash
set -euo pipefail

# Peace RSS - Weekly DB backup (Miniflux Postgres)
PROJECT_DIR="/opt/peace-rss"
BACKUP_DIR="${PROJECT_DIR}/backups"
ENV_FILE="${PROJECT_DIR}/.env"

mkdir -p "${BACKUP_DIR}"
cd "${PROJECT_DIR}"

# Load env vars (POSTGRES_USER/POSTGRES_DB) if present
if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

DB_USER="${POSTGRES_USER:-miniflux}"
DB_NAME="${POSTGRES_DB:-miniflux}"

TS="$(date +%F_%H%M%S)"
OUT_SQL="${BACKUP_DIR}/miniflux_${TS}.sql"

# Dump then compress
docker compose exec -T postgres pg_dump -U "${DB_USER}" "${DB_NAME}" > "${OUT_SQL}"
gzip -f "${OUT_SQL}"

OUT_GZ="${OUT_SQL}.gz"
if [ ! -s "${OUT_GZ}" ]; then
  echo "Backup failed: ${OUT_GZ} is empty" >&2
  exit 1
fi

# Retention: keep last 12 backups
ls -1t "${BACKUP_DIR}"/miniflux_*.sql.gz 2>/dev/null | tail -n +13 | xargs -r rm -f

echo "Backup complete: ${OUT_GZ}"
