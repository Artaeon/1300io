#!/usr/bin/env bash
# Dump the production PostgreSQL database and tar up the uploads volume.
#
# Usage: scripts/backup.sh [output-dir]
#   default output-dir: ./backups
#
# Env vars (exported by your shell, NOT baked in):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB  — matches .env
#   COMPOSE_FILE                                    — path to compose file
#
# Exits non-zero on any failure so it's safe to wire into cron + alert.

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
POSTGRES_USER="${POSTGRES_USER:-onorm1300}"
POSTGRES_DB="${POSTGRES_DB:-onorm1300}"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$OUTPUT_DIR"

DB_DUMP="$OUTPUT_DIR/db-$TIMESTAMP.sql.gz"
UPLOADS_DUMP="$OUTPUT_DIR/uploads-$TIMESTAMP.tar.gz"

echo "==> dumping database to $DB_DUMP"
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 > "$DB_DUMP"

echo "==> archiving uploads to $UPLOADS_DUMP"
docker compose -f "$COMPOSE_FILE" exec -T server \
  tar -C /data -czf - uploads \
  > "$UPLOADS_DUMP"

echo "==> done"
ls -lh "$DB_DUMP" "$UPLOADS_DUMP"
