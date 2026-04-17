#!/usr/bin/env bash
# Start an isolated PostgreSQL for running the server test suite
# against a real database, without colliding with any other running
# containers on your machine.
#
# Usage:
#   scripts/local-test-db.sh start   # create + wait for ready
#   scripts/local-test-db.sh stop    # remove the container + volume
#   scripts/local-test-db.sh env     # print DATABASE_URL + JWT_SECRET
#
# After `start`:
#   $(./scripts/local-test-db.sh env)
#   cd server && npx prisma migrate deploy && npm test
set -euo pipefail

NAME="onorm1300-test-pg"
HOST_PORT=5433
DB=onorm1300_test
USER=onorm1300
PASSWORD=test

case "${1:-}" in
  start)
    if docker ps -a --format '{{.Names}}' | grep -q "^${NAME}$"; then
      echo "container ${NAME} already exists — reusing"
      docker start "${NAME}" >/dev/null
    else
      docker run -d --name "${NAME}" \
        -e POSTGRES_DB="${DB}" \
        -e POSTGRES_USER="${USER}" \
        -e POSTGRES_PASSWORD="${PASSWORD}" \
        -p "${HOST_PORT}:5432" \
        postgres:16-alpine >/dev/null
      echo "started ${NAME}"
    fi
    for _ in $(seq 1 20); do
      if docker exec "${NAME}" pg_isready -U "${USER}" -d "${DB}" >/dev/null 2>&1; then
        echo "ready on localhost:${HOST_PORT}"
        exit 0
      fi
      sleep 1
    done
    echo "timeout waiting for ${NAME}" >&2
    exit 1
    ;;
  stop)
    docker rm -f "${NAME}" 2>/dev/null || true
    echo "removed ${NAME}"
    ;;
  env)
    echo "export DATABASE_URL='postgresql://${USER}:${PASSWORD}@localhost:${HOST_PORT}/${DB}'"
    echo "export JWT_SECRET='test-secret-at-least-16-characters-long'"
    echo "export NODE_ENV='test'"
    ;;
  *)
    echo "usage: $0 {start|stop|env}" >&2
    exit 2
    ;;
esac
