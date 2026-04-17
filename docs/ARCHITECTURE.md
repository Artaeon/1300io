# Architecture

High-level map of how the pieces fit. For deploying, see [DEPLOYMENT.md](DEPLOYMENT.md); for operating, see [RUNBOOK.md](RUNBOOK.md).

## Context

1300.io is a SaaS for Austrian property safety inspections under ÖNORM B 1300. Inspectors walk a property with a phone, work through a checklist, photograph defects, and produce a signed PDF report. The system also tracks defects across time: a defect found in inspection N stays "open" until a later inspection marks the same checklist item "OK".

## Components

```
┌────────────┐    HTTPS    ┌──────────────┐          ┌────────────┐
│  Browser   │────────────▶│   nginx      │          │            │
│  (React)   │             │   (client)   │─proxy───▶│   server   │
└────────────┘             └──────────────┘   /api   │  (Express) │
                                                     │            │
                                                     └─────┬──────┘
                                                           │
                                           ┌───────────────┼────────────────┐
                                           ▼               ▼                ▼
                                     ┌──────────┐    ┌──────────┐     ┌──────────┐
                                     │ postgres │    │ /data/   │     │ Sentry / │
                                     │ (db-data)│    │ uploads  │     │ Prom     │
                                     │          │    │          │     │ (optional)│
                                     └──────────┘    └──────────┘     └──────────┘
```

### client (`client/`)
- React 19 + React Router + Tailwind + Vite
- JWT in `localStorage`; `AuthContext` handles refresh
- Served as static assets by nginx in prod; Vite dev server in dev
- `ErrorBoundary` wraps the app so render failures don't white-screen
- CookieBanner is shown once per browser to disclose localStorage use

### server (`server/`)
- Express 5, Prisma, Node 22, **TypeScript 5.9 (strict)**. Production image runs `node dist/index.js` after `tsc` emits to `dist/`. Dev uses `tsx watch index.ts` so there's no build step in the loop
- Auth: bearer JWT, 15 min access token, 7 day single-use refresh token (rotates on use)
- Role-based authz: `ADMIN`, `MANAGER`, `INSPECTOR`, `READONLY`
- Org scoping: queries filtered by `organizationId` via `injectOrgFilter`; id-based endpoints additionally run `canAccessOrg(user, org)` and return 404 (not 403) on mismatch so record existence doesn't leak across tenants
- File uploads: multer → `sharp` image optimizer (2048px max, re-encode) → `/data/uploads`
- PDF generation: `pdfkit`, streamed directly to the HTTP response

### db
- PostgreSQL 16
- Schema is in `server/prisma/schema.prisma`
- Migrations in `server/prisma/migrations/` (applied by `prisma migrate deploy` at server startup)
- Index strategy: every FK has an index; hot read paths have compound indexes (property+status, inspection+item)

### uploads volume
- Named Docker volume `uploads-data` mounted at `/data/uploads` in the server container
- Served through nginx at `/uploads/*`
- Photos are resized to max 2048 px and re-compressed on upload

## Request lifecycle

1. Browser sends `Authorization: Bearer <JWT>`, matching origin in `Origin` header
2. nginx forwards to server with `X-Forwarded-Proto`, `X-Forwarded-For`, `Host`
3. Server middleware chain (in order):
   - `sentry.init` wraps the request for error capture (no-op without DSN)
   - `requestId` — attach/propagate `X-Request-Id`
   - `metricsMiddleware` — observe latency / count on response finish
   - `enforceHttps` — 301 if prod + http
   - `securityHeaders` (helmet) — CSP, HSTS, Referrer-Policy, etc.
   - `cors` — origin allowlist
   - `originCheck` — reject cross-origin POST/PUT/PATCH/DELETE in prod
   - `globalLimiter` — 100 req/min/IP
   - `express.json` (1 MB cap)
   - route-specific rate limiters (`loginLimiter`, `uploadLimiter`, `pdfLimiter`)
   - `authenticateToken` + `authorizeRoles` + `injectOrgFilter` (per route)
   - route handler (under `routes/`)
4. Errors bubble to `notFoundHandler` (404) or `errorHandler` (structured JSON with `requestId`)
5. Response carries `X-Request-Id` so the client can surface it in support tickets

## Data model

See `server/prisma/schema.prisma`. Highlights:

- `User` → `Organization` (nullable; null means "global" / seed admin)
- `Property` → `Organization` (nullable)
- `Inspection` → `Property`. Status `DRAFT` until `complete` → `COMPLETED`
- `InspectionResult` → `Inspection` + `ChecklistItem`. One result per (inspection, item)
- `DefectTracking` links the first-found result to a resolved result; status `OPEN` or `RESOLVED`
- `AuditLog` captures CREATE/UPDATE/DELETE actions on most entities with full previousData/newData JSON

## Extension points

- Additional routes: create `server/routes/<domain>.js`, mount in `server/index.js`
- Additional validations: add Zod schema in `server/schemas.js`, use `validateBody(...)` / `validateParams(...)`
- Additional metrics: extend `server/observability/metrics.js` with new `client.Counter` / `Histogram`
- i18n: not yet added. All UI strings are German. `react-i18next` would be the natural fit; strings live in `client/src/components/**`
- TypeScript: done on the server (strict mode, every file under `server/*.ts`). Client is still JSX — incremental migration can be done file-by-file, `@types/react` is already installed

## Known gaps

- No tracing (OpenTelemetry). RequestId gets you through logs; full distributed traces need a backend.
- Org scoping on `organizationId=null` users is permissive — they see unscoped data. Tightening this is a pending task that requires test coverage across every data endpoint first.
- The JWT lives in `localStorage` (XSS-reachable). Moving to `httpOnly` cookies is a bigger change that also requires real CSRF tokens.
