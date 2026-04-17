# ADR 001 — PostgreSQL for dev and prod

**Status:** accepted
**Date:** 2026-04-17

## Context

The initial stack used SQLite for dev and PostgreSQL for prod. Two databases, same schema, two sets of subtle behavior differences (case sensitivity, FK enforcement, JSON semantics, lack of `DISTINCT ON`, mixed driver quirks). Tests ran against SQLite, so prod-only bugs slipped through. Prisma's schema file is provider-locked — running a migration against a different provider than the schema declares is unsafe.

## Decision

Unify on **PostgreSQL 16-alpine for every environment** (local dev, CI, prod).

- `server/prisma/schema.prisma` declares `provider = "postgresql"`
- `docker-compose.yml` adds a `db` service for local dev
- `docker-compose.prod.yml` adds a `db` service backed by a named volume
- CI spins up a postgres service container and runs `prisma migrate deploy` before tests
- `.env.example` defaults `DATABASE_URL` to a postgres URL, not a SQLite file

Moved from `prisma db push` to versioned `prisma migrate deploy`. The server container runs `migrate deploy` as its entrypoint so a new release applies schema changes idempotently.

## Alternatives considered

- **Keep SQLite for dev:** faster spin-up, zero infra. Rejected because the dev/prod drift was already biting tests and the time-to-postgres via docker compose is seconds.
- **Provide a multi-provider schema:** Prisma doesn't support this without the (still preview) multi-file schema feature.
- **Move to a managed db (RDS, Cloud SQL):** orthogonal to this decision — the compose file is the starting point; managed-db migration path is documented in DEPLOYMENT.md.

## Consequences

- Dev requires Docker (or a local postgres). Bare `npm run dev` without the db container will fail with a clear connection error, not run against an accidental sqlite file.
- Every schema change now goes through a migration file in git, reviewable in PR.
- Index-by-default added on every FK column (see `schema.prisma`). Postgres's planner benefits; SQLite ignored them anyway.
- The server image is ~20MB larger because it ships the Prisma query engine binary for postgres instead of just SQLite's bundled engine.
