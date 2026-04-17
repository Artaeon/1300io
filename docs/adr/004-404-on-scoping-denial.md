# ADR 004 — Return 404 (not 403) on organization-scoping denial

**Status:** accepted
**Date:** 2026-04-17

## Context

Every id-based endpoint (`GET /api/properties/:id`, `GET /api/inspections/:id/pdf`, etc.) now runs an organization check via `canAccessOrg(user, record.organizationId)`. The question was how to respond when the caller has a valid JWT but is in the wrong organization.

A 403 tells the attacker "this id exists, you just can't see it." That's a subtle enumeration oracle — an attacker probing `/api/properties/1`, `/api/properties/2`, … can map which ids are assigned and to which tenants they belong, even without reading the data.

## Decision

**Return `404 Not Found` for both "doesn't exist" and "exists in a different org".**

The authorized UX impact is zero (the UI would never try to fetch something the user can't see). The enumeration oracle closes.

## Alternatives considered

- **403 Forbidden:** accurate HTTP semantics but leaks existence.
- **401 Unauthorized:** wrong — the caller is authenticated, just not authorized.
- **Deterministic 404 + separate audit-log entry:** adopted. `canAccessOrg` denials aren't audit-logged because the whole point is not to emit a tenant-boundary signal. Ordinary 404s (record genuinely doesn't exist) and cross-tenant denials are indistinguishable by design.

## Consequences

- Slight debugging cost: a dev staring at a 404 has to remember that org-scope is one reason. `logger.warn` on request-error level includes userId + orgId, so greppable in logs.
- Tests assert 404 for cross-tenant access; flipping this decision would require updating `__tests__/org-scoping.test.js`.
- Frontend error UX shows "nicht gefunden" either way — no change needed.
