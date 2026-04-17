# Architecture Decision Records

Short, dated notes on non-obvious architecture choices. Each ADR captures **what** we decided, **why**, and **what we rejected** — so the next person to touch the area can tell whether the original reasoning still holds.

Use the template: [`000-template.md`](000-template.md).

## Index

- [001 — PostgreSQL for dev and prod](001-postgres-for-dev-and-prod.md)
- [002 — Bearer JWT in localStorage (not httpOnly cookies)](002-jwt-in-localstorage.md)
- [003 — TypeScript on server, plain JSX on client for now](003-typescript-migration-scope.md)
- [004 — 404 (not 403) on org-scoping denial](004-404-on-scoping-denial.md)
