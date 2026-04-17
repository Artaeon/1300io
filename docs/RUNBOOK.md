# Runbook

Operational procedures for 1300.io production. Read end-to-end once, then refer as needed during incidents.

## Health checks

| Endpoint | Purpose | Expected |
| --- | --- | --- |
| `GET /healthz` | Liveness. Process is up. | `200 {"status":"ok"}` |
| `GET /readyz` | Readiness. DB reachable. | `200 {"status":"ready","db":"connected"}` |
| `GET /metrics` | Prometheus scrape | `200 text/plain`, needs `Authorization: Bearer $METRICS_TOKEN` in prod |

Point your load balancer at `/healthz` for traffic gating and `/readyz` for deploy-ready checks.

## Logs

JSON-structured in production (`NODE_ENV=production`), human-readable otherwise. Every log line includes `timestamp`, `level`, `msg`, and — when applicable — `requestId`, `userId`, `method`, `path`, `status`.

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 -f server
docker compose -f docker-compose.prod.yml logs --tail=200 -f db
```

Ship to a log aggregator (Loki, ELK, Datadog) by pointing the Docker log driver at your collector.

## Tracing an error

1. Get the `requestId` from the user (it's in the error response body).
2. `docker compose logs server | grep <requestId>` — everything that request did will share the id.
3. If Sentry is configured, cross-reference by request id in the Sentry event metadata.

## Metrics

Scrape `/metrics` every 15–30 s. Key series:

- `onorm1300_http_request_duration_seconds_bucket{...}` — latency histogram
- `onorm1300_http_requests_total{status="5xx"}` — error rate
- `onorm1300_nodejs_eventloop_lag_seconds` — event loop stalls (GC, CPU saturation)
- `onorm1300_nodejs_heap_size_used_bytes` — heap; rising means leak
- `onorm1300_process_resident_memory_bytes` — RSS; pair with node heap to catch native leaks (sharp, prisma)

Suggested alert seeds:
- 5xx rate > 1 % over 5 min
- p95 latency > 1 s for 5 min on `/api/inspections/:id/pdf`
- Event loop lag > 200 ms for 2 min

## Backups

`scripts/backup.sh` writes `db-<utc>.sql.gz` and `uploads-<utc>.tar.gz` into the chosen directory.

Recommended cron on the host:
```cron
# Every 6h
0 */6 * * * /opt/1300io/scripts/backup.sh /var/backups/1300io
# Daily cleanup, keep 30 days
15 3 * * * find /var/backups/1300io -type f -mtime +30 -delete
# Nightly sync to object storage (example: rclone)
30 3 * * * rclone sync /var/backups/1300io s3:company-backups/1300io
```

### Restore

```bash
scripts/restore.sh /path/db-20260417T030000Z.sql.gz \
                   /path/uploads-20260417T030000Z.tar.gz
```

After restore, rerun migrations to catch up to the current schema version:
```bash
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy
```

## Rotating JWT_SECRET

Rotating `JWT_SECRET` invalidates all active access tokens (users get 401) and all refresh tokens (users must log in again). Schedule during low traffic.

```bash
# Set the new value in your secrets manager / .env, then:
docker compose -f docker-compose.prod.yml up -d server
```

The server validates that the secret is 16+ chars and exits on startup if missing. Don't leave the old value set anywhere.

## Rotating POSTGRES_PASSWORD

```bash
# 1. Get a shell into the running db
docker compose -f docker-compose.prod.yml exec db psql -U "$POSTGRES_USER" -d postgres

# 2. In psql:
ALTER USER onorm1300 WITH PASSWORD '<new>';

# 3. Update POSTGRES_PASSWORD in the secrets store
# 4. Restart the server so it picks up the new DATABASE_URL
docker compose -f docker-compose.prod.yml up -d server
```

## Running one-off tasks

```bash
# Prisma migration status
docker compose exec server npx prisma migrate status

# Manual migration apply (normally automatic on startup)
docker compose exec server npx prisma migrate deploy

# Create additional admin
docker compose exec -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e ADMIN_NAME=... \
  server node seed_user.js

# Reset checklist to defaults
docker compose exec server node prisma/seed.js
```

## Common failures

### 502 from nginx / client

The server container is unhealthy. Check:
```bash
docker compose ps
docker compose logs server --tail=100
```
If the server failed on boot, likely causes: bad `DATABASE_URL`, missing `JWT_SECRET`, or the db container still starting (healthcheck timeout).

### `PrismaClientInitializationError: Can't reach database server`

Db container is down, or `DATABASE_URL` points at the wrong host. In the compose network it should be `db:5432`, not `localhost`.

### Disk full

Uploads grow unbounded. Inspect:
```bash
docker compose exec server du -sh /data/uploads
```
The image optimizer (`sharp`) caps new uploads at 2048 px but historical originals may predate it. If needed, re-process the directory offline.

### High memory on server

Look at metrics first:
- `nodejs_heap_size_used_bytes` growing → Node leak (likely in-flight Prisma queries or PDF generation). Restart, then profile
- `process_resident_memory_bytes` growing but heap flat → native leak (sharp or prisma-engine). Restart; file issue with repro

### Rate-limit hits in logs

`Too many requests` 429s are normal under abuse but a steady stream from legitimate traffic means the limits are too tight. Adjust in `server/middleware/rateLimiters.js`. Most likely culprit: PDF generation for organizations with many inspections per minute.

## Escalation

Security issues: `security@stoicera.com` (see [SECURITY.md](../SECURITY.md)).
Everything else: `office@stoicera.com`.
