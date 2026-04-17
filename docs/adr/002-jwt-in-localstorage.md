# ADR 002 — Bearer JWT in localStorage (not httpOnly cookies)

**Status:** accepted, with known trade-offs
**Date:** 2026-04-17

## Context

The client is a Vite SPA served from its own origin (via the nginx container). The API lives at `/api/*` behind the same origin in prod, but dev uses a Vite proxy. We need a session mechanism that:

1. Survives page reloads
2. Works cross-tab
3. Handles refresh rotation without UX breakage
4. Doesn't silently expose long-lived credentials

## Decision

Store the access token (15 min) and the refresh token (7 day, single-use rotating) in **localStorage**. Client sends `Authorization: Bearer <jwt>` on every API request. `AuthContext.authFetch` intercepts 401, calls `/api/auth/refresh` once (deduped via a ref-held promise), and replays the request.

State-changing endpoints in prod also run an `Origin`/`Referer` check (see middleware/originCheck.ts) as defense-in-depth, so if this ADR is ever revisited and tokens move to cookies, classical CSRF protections are still in place.

## Alternatives considered

- **httpOnly + Secure + SameSite=Strict cookies:** immune to XSS token theft, but requires real CSRF tokens on every state-changing request, and cross-origin dev (e.g. Storybook) becomes painful. Revisit if/when we add MFA or handle regulated PII beyond inspection data.
- **In-memory-only access token + httpOnly refresh cookie:** best-of-both, but doubles the auth code surface; not worth it for the current risk profile.
- **Session-cookie only:** doesn't work well with a JSON API, and rules out mobile clients that may be built against the same endpoints later.

## Consequences

- **Known risk:** any XSS vulnerability is also a token-exfil vulnerability. Mitigations: strict CSP (script-src 'self'), eslint-plugin-jsx-a11y + (future) react/no-danger, and CodeQL weekly scan.
- CookieBanner is shown once per browser because localStorage is technically "storage" and DSGVO transparency matters — the banner explicitly states no tracking cookies.
- Refresh rotation works across tabs via the natural `refreshPromiseRef` dedup on first 401.
- If the user clears site data, they're logged out — which is the expected behavior.
