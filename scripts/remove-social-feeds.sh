#!/usr/bin/env bash
# One-off cleanup after removing social feeds (Instagram / X via RSS-Bridge).
#
# Deletes every Miniflux feed that points at the removed /api/social/rss/ proxy,
# then deletes "Instagram" and "Twitter" categories that are left empty.
# Entries of deleted feeds are removed by Miniflux's ON DELETE CASCADE.
#
# Usage (from the repo root, where the compose stack runs):
#   scripts/remove-social-feeds.sh                 # dry run: only lists what would go
#   scripts/remove-social-feeds.sh --apply         # actually delete
#   COMPOSE_FILE=docker-compose.prod.yml scripts/remove-social-feeds.sh [--apply]
set -euo pipefail

cd "$(dirname "$0")/.."

APPLY=0
if [ "${1:-}" = "--apply" ]; then
  APPLY=1
elif [ -n "${1:-}" ]; then
  echo "Unknown argument: $1 (use --apply or nothing)" >&2
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

psql() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q "$@"' -- "$@"
}

SOCIAL_FEEDS="f.feed_url LIKE '%/api/social/rss/%'"
SOCIAL_CATEGORIES="lower(trim(c.title)) IN ('instagram', 'twitter')"

echo "Social feeds to delete:"
psql -c "
  SELECT u.username, f.id AS feed_id, f.title,
         (SELECT count(*) FROM entries e WHERE e.feed_id = f.id) AS entries
  FROM feeds f JOIN users u ON u.id = f.user_id
  WHERE $SOCIAL_FEEDS
  ORDER BY u.username, f.title;"

echo "Instagram/Twitter categories that will be empty afterwards (to delete):"
psql -c "
  SELECT u.username, c.id AS category_id, c.title
  FROM categories c JOIN users u ON u.id = c.user_id
  WHERE $SOCIAL_CATEGORIES
    AND NOT EXISTS (
      SELECT 1 FROM feeds f WHERE f.category_id = c.id AND NOT ($SOCIAL_FEEDS)
    )
  ORDER BY u.username;"

if [ "$APPLY" -ne 1 ]; then
  echo "Dry run only. Re-run with --apply to delete the rows above."
  exit 0
fi

psql -c "
  BEGIN;
  DELETE FROM feeds f WHERE $SOCIAL_FEEDS;
  DELETE FROM categories c
  WHERE $SOCIAL_CATEGORIES
    AND NOT EXISTS (SELECT 1 FROM feeds f WHERE f.category_id = c.id);
  COMMIT;"

echo "Done. Social feeds and their empty categories are removed."
