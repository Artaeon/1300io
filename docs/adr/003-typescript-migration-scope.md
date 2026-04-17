# ADR 003 — TypeScript on server, plain JSX on client for now

**Status:** accepted
**Date:** 2026-04-17

## Context

The codebase started as plain JavaScript on both sides. Enterprise readiness requires static types where bugs are most expensive to debug in prod — input validation, auth, data transformations — but a full-repo migration would be a ceremony of its own with little short-term ROI on UI components whose props are obvious from usage.

## Decision

- **Server: fully TypeScript, strict mode.** `tsconfig.json` enables `strict`, `noImplicitAny`, `noUnusedLocals`, `noUncheckedIndexedAccess`. Prod image runs `node dist/index.js` after `tsc` emits to `dist/`; dev uses `tsx watch index.ts`.
- **Client: stays JSX for now.** `@types/react` and `@types/react-dom` are already installed so we can flip individual files to `.tsx` as they're touched, without a migration project.

## Alternatives considered

- **Full monorepo TS:** too much churn for ~30 small React components whose shapes are stable.
- **Server JSDoc + checkJs:** less churn than real TS, but worse editor experience and weaker refinement in generic code (Zod schemas, Prisma types).
- **Deno / Bun:** the runtime matters less than the type system here, and node:22-alpine is battle-tested at scale.

## Consequences

- Server build step is now real (`npm run build` → `dist/`). Dockerfile is two-stage so the runtime image doesn't ship the compiler or devDependencies.
- `tsx` handles dev + tests without a build, so the inner loop is unchanged.
- CI added `typecheck` and `build` steps between lint and test. Type errors now block PRs.
- Client lint gate (eslint-plugin-jsx-a11y on error) catches UI-layer bugs that TypeScript would have caught differently. When we eventually migrate client too, drop those rules where the compiler subsumes them.
