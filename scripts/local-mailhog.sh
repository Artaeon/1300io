#!/usr/bin/env bash
# Start a local MailHog container for exercising the verification /
# password-reset email flows without touching a real SMTP provider.
#
# Host ports are offset (1026 / 8026) so they don't collide with other
# SMTP or admin UIs you might already have running.
#
# Usage:
#   scripts/local-mailhog.sh start   # create + wait for ready
#   scripts/local-mailhog.sh stop    # remove the container
#   scripts/local-mailhog.sh env     # print SMTP_* env for the server
#   scripts/local-mailhog.sh ui      # print the web UI URL
#
# After `start`:
#   $(./scripts/local-mailhog.sh env)
#   cd server && npm run dev
#   open http://localhost:8026   # inbox
set -euo pipefail

NAME="onorm1300-mailhog"
SMTP_PORT=1026
UI_PORT=8026

case "${1:-}" in
  start)
    if docker ps -a --format '{{.Names}}' | grep -q "^${NAME}$"; then
      echo "container ${NAME} already exists — reusing"
      docker start "${NAME}" >/dev/null
    else
      docker run -d --name "${NAME}" \
        -p "${SMTP_PORT}:1025" \
        -p "${UI_PORT}:8025" \
        mailhog/mailhog >/dev/null
      echo "started ${NAME}"
    fi
    for _ in $(seq 1 20); do
      if curl -sf "http://localhost:${UI_PORT}/api/v2/messages?limit=1" >/dev/null 2>&1; then
        echo "ready — SMTP localhost:${SMTP_PORT}, UI http://localhost:${UI_PORT}"
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
    echo "export SMTP_HOST='localhost'"
    echo "export SMTP_PORT='${SMTP_PORT}'"
    echo "export SMTP_SECURE='false'"
    echo "export SMTP_FROM='1300.io dev <no-reply@dev.1300.io>'"
    ;;
  ui)
    echo "http://localhost:${UI_PORT}"
    ;;
  *)
    echo "usage: $0 {start|stop|env|ui}" >&2
    exit 2
    ;;
esac
