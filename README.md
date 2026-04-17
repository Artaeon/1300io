<p align="center">
  <h1 align="center">1300.io</h1>
  <p align="center">
    Open-source SaaS platform for Austrian property safety inspections<br />
    following <strong>ÖNORM B 1300</strong>
  </p>
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a> &middot;
  <a href="#local-development"><strong>Local Dev</strong></a> &middot;
  <a href="#screenshots"><strong>Screenshots</strong></a> &middot;
  <a href="#architecture"><strong>Architecture</strong></a> &middot;
  <a href="#configuration"><strong>Configuration</strong></a> &middot;
  <a href="#testing"><strong>Testing</strong></a> &middot;
  <a href="#contributing"><strong>Contributing</strong></a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-189%20server%20%2F%2036%20client-brightgreen">
  <img alt="Language" src="https://img.shields.io/badge/UI-Deutsch-black">
</p>

---

## Overview

1300.io is a mobile-first inspection platform built for Austrian property managers (*Hausverwaltungen*). It streamlines the legally mandated ÖNORM B 1300 safety inspection workflow — from on-site checklist completion to court-admissible PDF report generation — in a single paperless application.

**Walk through a building with your phone, tick off the standardized checklist, photograph defects on the spot, and hand the owner a signed PDF report before you leave the staircase.**

### Key Features

- **Mobile-first UI** — iOS-style frosted glass, one-handed operation, full dark mode, German throughout
- **Integrated camera** — document defects with photos directly within the inspection flow
- **Instant PDF reports** — professional reports with embedded photos, compliant with Austrian legal standards
- **Email verification + password reset** — self-service flows via real SMTP (MailHog for local dev)
- **Role-based access** — Admin, Manager, Inspector, Read-only with granular permissions
- **Multi-organization support** — manage multiple Hausverwaltungen from a single instance
- **ÖNORM B 1300 checklists** — pre-configured categories (roof, facade, staircase, technical systems, exterior)
- **Defect tracking** — follow defect lifecycle across inspections with automatic resolution detection
- **Offline-aware** — inspection wizard tolerates spotty connectivity on-site
- **Complete audit trail** — every mutation logged with actor, IP, timestamp, previous state

### Security & Operations

- Hashed passwords (bcrypt, 12 rounds) with a 12-char complexity policy and weak-password blocklist
- Rotating single-use refresh tokens (7 d) + short-lived access tokens (15 min)
- Per-email account lockout after repeated failures (credential-stuffing defense)
- Rate limits on `/api/auth/*`, `/api/upload`, and global API; CORS restricted to `FRONTEND_URL`
- Helmet + strict CSP, X-Frame-Options, Referrer-Policy, no-sniff
- Every request carries a `X-Request-Id` that appears in logs, error bodies, traces
- Prometheus metrics at `/metrics` (bearer-token-gated in prod) and OpenAPI/Swagger at `/api/docs`
- Optional OpenTelemetry tracing (OTLP/HTTP) — point at Jaeger / Tempo / Honeycomb with one env var

---

## Screenshots

### Light Mode

<table>
  <tr>
    <td align="center"><strong>Login</strong></td>
    <td align="center"><strong>Dashboard</strong></td>
    <td align="center"><strong>Property Detail</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/login.png" width="260" alt="Login screen" /></td>
    <td><img src="docs/screenshots/dashboard.png" width="260" alt="Dashboard" /></td>
    <td><img src="docs/screenshots/property-detail.png" width="260" alt="Property detail with QR code and defect tracking" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Inspection Wizard</strong></td>
    <td align="center"><strong>Inspection Complete</strong></td>
    <td align="center"><strong>Admin Panel</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/inspection-wizard.png" width="260" alt="Mobile inspection checklist" /></td>
    <td><img src="docs/screenshots/pdf-report.png" width="260" alt="Inspection completion and PDF download" /></td>
    <td><img src="docs/screenshots/admin-panel.png" width="260" alt="Admin user management" /></td>
  </tr>
</table>

### Dark Mode

<table>
  <tr>
    <td align="center"><strong>Login</strong></td>
    <td align="center"><strong>Dashboard</strong></td>
    <td align="center"><strong>Inspection Wizard</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/login-dark.png" width="260" alt="Login dark mode" /></td>
    <td><img src="docs/screenshots/dashboard-dark.png" width="260" alt="Dashboard dark mode" /></td>
    <td><img src="docs/screenshots/inspection-wizard-dark.png" width="260" alt="Inspection wizard dark mode" /></td>
  </tr>
</table>

---

## Architecture

```
┌──────────────────┐      ┌───────────────────┐      ┌──────────────────┐
│     Client       │      │      Server       │      │     Database     │
│                  │      │                   │      │                  │
│  React 19        │ REST │  Express 5        │ ORM  │  PostgreSQL 16   │
│  Vite 7 / Tail 4 │◄────►│  TypeScript 5     │◄────►│  (migrations-    │
│  React Router 7  │ JSON │  Prisma 5         │      │   driven)        │
│  Lucide icons    │      │  PDFKit · Sharp   │      │                  │
└──────────────────┘      └───────────────────┘      └──────────────────┘
         :5173                    :3000                      :5432
                                    │
                                    ├──► SMTP (nodemailer) ── verification & reset emails
                                    ├──► Prometheus /metrics (bearer-gated in prod)
                                    └──► OTLP/HTTP tracing (opt-in)
```

The project is a monorepo with two packages plus e2e tests at the root.

| Package | Stack | Purpose |
|---------|-------|---------|
| `client/` | React 19, Vite 7, Tailwind 4, React Router 7 | Mobile-first SPA with iOS-style UI and dark mode |
| `server/` | TypeScript 5.9 (strict), Express 5, Prisma 5.10, PDFKit, Sharp, nodemailer | REST API, JWT auth, PDF generation, email, tracing |
| `e2e/` | Playwright 1.59 | Browser-level regression suite against the full stack |

### Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — request lifecycle, data model, extension points
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deploy with docker-compose + GHCR
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — logs, metrics, tracing, backups, secret rotation, incident response
- [docs/adr/](docs/adr/) — architecture decision records
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, branching model, commit style
- [SECURITY.md](SECURITY.md) — vulnerability disclosure
- API reference: `/api/docs` (Swagger UI) and `/api/openapi.json` (raw spec) on a running server

---

## Quick Start

### Prerequisites

- **Docker** and **Docker Compose** (for the Docker path)
- Or: **Node.js 22.x** and **npm 10+** for local development (Node 23+ is not supported)
- Linux, macOS, or Windows (WSL recommended)

### Option 1 — Docker (recommended for evaluation)

```bash
git clone https://github.com/Artaeon/1300io.git
cd 1300io

cp .env.example .env
# Edit .env — at minimum set:
#   JWT_SECRET=$(openssl rand -base64 32)
#   POSTGRES_PASSWORD=<a strong value>
#   ADMIN_EMAIL, ADMIN_PASSWORD (first admin user)

docker-compose up -d --build

# First-run database setup
docker-compose exec server npm run db:migrate:deploy
docker-compose exec server npm run db:seed        # ÖNORM categories + items
docker-compose exec server npm run db:seed:admin  # initial admin user
```

Open http://localhost:5173 and sign in with the admin you just seeded.

### Option 2 — Local dev without Docker

See [Local Development](#local-development) below. You get isolated Postgres + MailHog helpers, hot-reload, and full observability.

---

## Local Development

The repo ships with helper scripts that stand up an isolated Postgres and a local SMTP sink (MailHog) on non-standard ports, so they never collide with anything else running on your machine.

```bash
# 1. Install deps
npm install --workspaces=false   # root devDeps (Playwright, husky)
cd server && npm install && cd ..
cd client && npm install && cd ..

# 2. Start infra (Docker — isolated ports 5433 + 1026 + 8026)
./scripts/local-test-db.sh start    # postgres  → localhost:5433
./scripts/local-mailhog.sh start    # smtp 1026, UI http://localhost:8026

# 3. Migrate + seed
cd server
eval $(../scripts/local-test-db.sh env)     # DATABASE_URL + JWT_SECRET + NODE_ENV
npx prisma migrate deploy
npm run db:seed                              # checklist categories + items
ADMIN_EMAIL=admin@local.dev ADMIN_PASSWORD='Sup3rSecret!Pass123' npm run db:seed:admin

# 4. Dev servers (two terminals)
# ── terminal A (server) ──
eval $(../scripts/local-test-db.sh env)
eval $(../scripts/local-mailhog.sh env)
FRONTEND_URL=http://localhost:5173 PORT=3100 npm run dev

# ── terminal B (client) ──
cd ../client
VITE_API_TARGET=http://localhost:3100 npm run dev
```

You now have:

| Service | URL |
|---------|-----|
| Client (Vite) | http://localhost:5173 |
| API | http://localhost:3100 |
| API docs (Swagger) | http://localhost:3100/api/docs |
| MailHog web inbox | http://localhost:8026 |
| Postgres | `localhost:5433` (user `onorm1300`, db `onorm1300_test`) |

Register a user at `/login` → check MailHog at **http://localhost:8026** → click the verification link → you're signed in. Same path for `/forgot-password`.

### Teardown

```bash
./scripts/local-mailhog.sh stop
./scripts/local-test-db.sh stop
```

---

## Production Deployment

```bash
cp .env.example .env.production
# Fill in real values — see Configuration below

docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# One-off setup
docker-compose -f docker-compose.prod.yml exec server npm run db:migrate:deploy
docker-compose -f docker-compose.prod.yml exec server npm run db:seed
docker-compose -f docker-compose.prod.yml exec server npm run db:seed:admin
```

### Production checklist

| Requirement | Details |
|-------------|---------|
| `JWT_SECRET` | Cryptographically random, ≥ 32 chars (`openssl rand -base64 32`) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Exact frontend origin (scheme + host, no trailing slash) — used for CORS and email links |
| `DATABASE_URL` | PostgreSQL connection string; run `npm run db:migrate:deploy` on every release |
| `SMTP_*` | Real SMTP credentials if users register themselves |
| `REQUIRE_EMAIL_VERIFICATION=true` | Recommended once SMTP is live |
| `METRICS_TOKEN` | Required — `/metrics` is bearer-gated in prod |
| HTTPS | Terminate at your reverse proxy (nginx, Caddy, Traefik) |
| Backups | See [docs/RUNBOOK.md](docs/RUNBOOK.md) — `pg_dump` + off-site rotation |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full production walkthrough.

---

## Configuration

All configuration is environment-driven. Copy `.env.example` to `.env` for the complete list with inline comments.

### Core

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `JWT_SECRET` | Yes | — | Secret for signing JWT access + refresh tokens (≥ 32 chars) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `3000` | Express listen port |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed CORS origin; used for email links |
| `UPLOAD_DIR` | No | `./uploads` | Directory for uploaded inspection photos |
| `LOG_LEVEL` | No | `info` | `fatal` / `error` / `warn` / `info` / `debug` / `trace` |

### Email (verification + password reset)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | Leave blank to disable — mailer falls back to `jsonTransport` (logs only) |
| `SMTP_PORT` | Typically `587` (STARTTLS) or `465` (implicit TLS) |
| `SMTP_SECURE` | `true` for implicit TLS, `false` otherwise |
| `SMTP_USER` / `SMTP_PASS` | Credentials (if your provider requires auth) |
| `SMTP_FROM` | `From:` header, e.g. `1300.io <no-reply@1300.io>` |
| `REQUIRE_EMAIL_VERIFICATION` | `true` blocks login until email is verified (requires `SMTP_HOST`) |

### Observability

| Variable | Description |
|----------|-------------|
| `METRICS_TOKEN` | Prometheus scrape token; `/metrics` is open in dev, required in prod |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | e.g. `http://localhost:4318` — enables OTel tracing when set |
| `OTEL_EXPORTER_OTLP_HEADERS` | e.g. `x-honeycomb-team=<key>` |
| `OTEL_SERVICE_NAME` | Defaults to `onorm1300-server` |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Optional — install `@sentry/node` / `@sentry/react` to enable |

### Seed admin

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Used only by `npm run db:seed:admin` — not loaded at runtime |

> **Security:** Never commit `.env`. Use ≥ 32 random chars for `JWT_SECRET`. Set `FRONTEND_URL` to your exact origin in prod. Rotating `JWT_SECRET` invalidates all active sessions (intentional — see [docs/RUNBOOK.md](docs/RUNBOOK.md#secret-rotation)).

---

## Authentication & Authorization

- **Registration** — `POST /api/auth/register` creates a user and (if SMTP is configured) sends a German verification email.
- **Verification** — token-gated single-use link to `/verify-email?token=…`; 24 h expiry, auto-invalidates siblings.
- **Password reset** — `/forgot-password` always returns 200 (no email enumeration); reset link consumes a single-use 1 h token and revokes all refresh tokens.
- **Login** — issues a 15 min access JWT and a rotating 7 d refresh token. `REQUIRE_EMAIL_VERIFICATION=true` blocks unverified users with `{ code: 'EMAIL_NOT_VERIFIED' }`.
- **Lockout** — per-email rate-based lockout on repeated failures (credential-stuffing defense) — all events land in the audit log.

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — users, organizations, properties, checklists, audit log, all inspections |
| **Manager** | Create and manage properties; view all inspections within their organization |
| **Inspector** | Create and complete inspections, upload defect photos |
| **Read-only** | View properties and download inspection reports |

---

## Testing

```bash
# Server tests (189 tests, real Postgres required)
cd server
eval $(../scripts/local-test-db.sh env)
npx prisma migrate deploy
npm test

# Client tests (36 tests, jsdom)
cd client && npm test

# All unit/integration tests from root
npm test

# End-to-end (Playwright — requires server + client running on 3100 / 5173)
npx playwright install chromium   # first run only
npm run test:e2e                   # headless
npm run test:e2e:ui                # time-travel debugger
```

Coverage spans: auth flows, email verification, password reset, ÖNORM checklist integrity, inspection lifecycle, PDF generation, audit log, rate limits, CSP, error handling, organization management, rate-limited endpoints, and a register-to-signed-PDF end-to-end happy path.

See [e2e/README.md](e2e/README.md) for the Playwright run recipe.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19 |
| Build | Vite | 7 |
| Styling | Tailwind CSS | 4 |
| Router | React Router | 7 |
| Icons | lucide-react | — |
| Backend | Express | 5 |
| Language | TypeScript (strict) | 5.9 |
| ORM | Prisma | 5.10 |
| Database | PostgreSQL | 16 |
| Email | nodemailer | 8 |
| PDF | PDFKit | 0.17 |
| Images | Sharp | 0.34 |
| Auth | JWT + bcryptjs | — |
| Validation | Zod | 4 |
| Metrics | prom-client | 15 |
| Tracing | OpenTelemetry (OTLP/HTTP) | — |
| E2E | Playwright | 1.59 |
| Container | Docker + Docker Compose | — |

---

## Data & Compliance

- **Audit trail** — every mutation is logged with actor, timestamp, IP, request ID, and previous state
- **DSGVO / GDPR** — privacy policy at `/datenschutz`; data export and deletion via admin UI
- **Impressum** — `/impressum` as required by Austrian law (§ 5 ECG)
- **PDF reports** — generated on demand from inspection data; regeneration is deterministic
- **Retention** — inspection records retained indefinitely by default; configurable

---

## Contributing

Pull requests, issues, and translations are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, branching model, and commit style. The codebase is fully typed on the server (TS strict) and ESLint-clean on both sides.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Do not open public issues for security reports.

## License

Distributed under the [MIT License](LICENSE).

---

<p align="center">
  Copyright &copy; 2026 <a href="https://stoicera.com">Stoicera GesbR</a>
</p>
