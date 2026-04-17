# Deployment

This document describes the production deployment model. Dev setup is in the root [README.md](../README.md).

## Architecture

- **server** (Node.js / Express, PostgreSQL via Prisma) — REST API at `/api/*`
- **client** (React / Vite, static build) — served by nginx which also reverse-proxies `/api/` and `/uploads/` to the server
- **db** (PostgreSQL 16) — persistent volume `db-data`
- **uploads** — persistent volume `uploads-data` mounted at `/data/uploads` in the server container

All three services are defined in [`docker-compose.prod.yml`](../docker-compose.prod.yml).

## Prerequisites

- Docker Engine 24+ with `docker compose` plugin
- A host with 2 vCPU, 4 GB RAM, 20 GB SSD minimum
- A domain name pointing at the host
- A reverse proxy in front (nginx, Caddy, Traefik) terminating TLS — the compose file does **not** terminate TLS itself

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | yes | 32+ chars. `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | yes | Generate, store in a secret manager |
| `POSTGRES_USER`, `POSTGRES_DB` | no | Defaults `onorm1300` / `onorm1300` |
| `FRONTEND_URL` | yes | The public HTTPS origin, e.g. `https://app.example.com` |
| `METRICS_TOKEN` | recommended | Bearer token required for `/metrics` in prod |
| `SENTRY_DSN` | optional | Error tracking. Install `@sentry/node` to enable |
| `VITE_SENTRY_DSN` | optional | Client-side Sentry |
| `VITE_IMPRESSUM_PHONE` | optional | Shown on /impressum; omitted if blank |

`NODE_ENV=production` is set in the compose file — don't override it.

## First-time deploy

```bash
# 1. Build images locally (or pull from ghcr.io after a tagged release)
docker compose -f docker-compose.prod.yml build

# 2. Start db first and wait for it to become healthy
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml ps

# 3. Start everything. The server container runs `prisma migrate deploy`
#    as its entrypoint, so the schema is created/updated on startup.
docker compose -f docker-compose.prod.yml up -d

# 4. Seed the checklist and create an initial admin user
docker compose -f docker-compose.prod.yml exec server npm run db:seed
docker compose -f docker-compose.prod.yml exec -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD='<at-least-12-chars-Mixed-case-with-digits>' \
  -e ADMIN_NAME='You' \
  server npm run db:seed:admin
```

## Releases via GHCR

`v*.*.*` tags trigger [`.github/workflows/release.yml`](../.github/workflows/release.yml), which builds and pushes `ghcr.io/<owner>/<repo>/{server,client}`.

To deploy a tag instead of building locally, point the compose file at the registry image:

```yaml
server:
  image: ghcr.io/artaeon/1300io/server:1.2.3
  # build: ... (remove or comment)
```

## Updates

```bash
git pull --tags
docker compose -f docker-compose.prod.yml pull   # if using ghcr images
docker compose -f docker-compose.prod.yml up -d --no-deps server client
```

Migrations are applied automatically by the server entrypoint. If a migration is destructive (a column drop, a type change), run it in a maintenance window and take a backup first.

## Backups

`scripts/backup.sh [output-dir]` dumps the db and tars `/data/uploads`. See [RUNBOOK.md](RUNBOOK.md) for scheduling and restore.

## Monitoring

- `/healthz` — liveness (always 200)
- `/readyz` — readiness (checks DB)
- `/metrics` — Prometheus format, Bearer-token protected in prod

## Secrets

**Do not keep production `.env` files on developer laptops.** Options, in order of preference:
1. A secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) that injects env vars at container start
2. Docker secrets (`docker compose` supports `secrets:` blocks) for passwords / API keys
3. `.env` on the production host with 0600 perms, never pushed to source control (already in `.gitignore`)

## TLS

Run a reverse proxy in front that terminates TLS. Minimum nginx example:

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;
  ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

`X-Forwarded-Proto: https` is critical — the app uses it to decide whether to redirect to HTTPS and to emit the HSTS header.
