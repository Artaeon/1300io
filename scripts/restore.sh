#!/usr/bin/env bash
# Restore a database dump + uploads archive produced by scripts/backup.sh.
#
# Usage: scripts/restore.sh <db-dump.sql.gz> <uploads.tar.gz>
#
# DESTRUCTIVE: the DB dump uses --clean --if-exists, so existing tables
# are dropped before restore. Upload files are overwritten.
# Requires a running `docker compose -f docker-compose.prod.yml`.

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <db-dump.sql.gz> <uploads.tar.gz>" >&2
  exit 2
fi

DB_DUMP="$1"
UPLOADS_DUMP="$2"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
POSTGRES_USER="${POSTGRES_USER:-onorm1300}"
POSTGRES_DB="${POSTGRES_DB:-onorm1300}"

[ -f "$DB_DUMP" ] || { echo "not found: $DB_DUMP" >&2; exit 1; }
[ -f "$UPLOADS_DUMP" ] || { echo "not found: $UPLOADS_DUMP" >&2; exit 1; }

read -r -p "This will OVERWRITE the running database and uploads. Continue? [y/N] " yn
case "$yn" in [yY]*) ;; *) echo "aborted"; exit 1 ;; esac

echo "==> restoring database from $DB_DUMP"
gunzip -c "$DB_DUMP" \
  | docker compose -f "$COMPOSE_FILE" exec -T db \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "==> restoring uploads from $UPLOADS_DUMP"
docker compose -f "$COMPOSE_FILE" exec -T server \
  sh -c "rm -rf /data/uploads && mkdir -p /data && tar -C /data -xzf -" \
  < "$UPLOADS_DUMP"

echo "==> done. Consider running 'prisma migrate deploy' to sync schema"
