# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Infrastructure & Deployment
- PostgreSQL service in production docker-compose with persistent named volumes for database and uploads
- Versioned Prisma migrations (initial migration replaces the `db push` workflow)
- Release workflow (`.github/workflows/release.yml`) — builds and pushes server + client images to GHCR on `v*.*.*` tags, cross-built for linux/amd64 and linux/arm64
- CodeQL weekly + on-PR security scanning
- Dependabot covering npm (server, client, root), GitHub Actions, and Docker base images
- Backup and restore scripts (`scripts/backup.sh`, `scripts/restore.sh`)

### Added — Observability
- Request ID correlation: `X-Request-Id` on every response, propagated into every log line, included in every error body
- Prometheus metrics at `/metrics` (bearer-token gated in prod)
- Optional Sentry integration on server and client (lazy-required; no dep bloat)
- Graceful shutdown on SIGTERM/SIGINT with `/readyz` flipping to 503 before socket close

### Added — Security
- HTTPS enforcement middleware (redirects GET/HEAD, rejects state-changing verbs on plain HTTP in prod)
- Explicit Content Security Policy via Helmet (script-src 'self', frame-ancestors 'none', etc.) + HSTS in prod
- Origin check on state-changing requests as defense-in-depth
- Organization scoping enforced on every id-based endpoint (properties, inspections, defects, exports); cross-tenant access returns 404 not 403 to prevent enumeration
- Password policy: 12+ chars, complexity, weak-password blocklist
- nginx hardening: X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS, slow-loris timeouts, dotfile denial

### Added — Developer experience
- TypeScript on server, strict mode, with `tsc` build step and `tsx` for dev + tests
- ESLint for server (previously client-only); `typecheck` and `build` steps added to CI
- eslint-plugin-jsx-a11y on error (after retrofit of form labels and autoComplete attributes)
- husky + lint-staged pre-commit hook runs per-subpackage eslint on staged files
- Bundle analyzer (`npm run build:analyze`) and vendor chunking for React + Lucide
- Node 22 pinned via `engines` + `.nvmrc`

### Added — Product
- ErrorBoundary wraps the app; 404 page; dedicated NotFound component
- Cookie / storage notice (DSGVO transparency, dismissible once)
- Impressum, Datenschutz, AGB (Austrian ECG + DSGVO compliance surface)
- Audit log viewer at `/admin/audit-logs` with filters and previous/new-state diffs
- Image optimization on upload (sharp): 2048px max, re-encoded with mozjpeg / PNG 9 / WebP 85
- OpenAPI 3 spec at `/api/openapi.json` + Swagger UI at `/api/docs`

### Added — Documentation
- `docs/ARCHITECTURE.md` — request lifecycle and data model
- `docs/DEPLOYMENT.md` — zero-to-running in prod
- `docs/RUNBOOK.md` — logs, metrics, backup cron, secret rotation, common failures
- `docs/adr/` — first four Architecture Decision Records (postgres, jwt storage, TS scope, 404-on-scoping-denial)
- PR + issue templates (German), CODEOWNERS

### Changed
- Error responses now include `requestId` for support-ticket traceability
- `server/index.ts` split from a 1057-line monolith into route modules under `server/routes/`
- Shared `PrismaClient` singleton (was instantiated 3 times across the process)

### Fixed
- Production data was ephemeral — the compose file had no volumes. Now it does
- Placeholder phone number in Impressum (`+43 (0) XXX XXX XXX`) — read from `VITE_IMPRESSUM_PHONE` or omitted
- Test setup no longer clobbers a CI-provided `DATABASE_URL` with `file:./test.db`
