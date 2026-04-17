// Preload file: runs before everything else when node/tsx is launched
// with --require (or when it's the first import in the entry point).
//
//   node --require ./dist/observability/preload.js dist/index.js
//   tsx --require ./observability/preload.ts index.ts
//
// Keeping init here (vs. inline in index.ts) lets the OTel
// auto-instrumentations patch http/express/prisma BEFORE those
// modules are first required. Otherwise instrumentation misses the
// early requires and we lose spans.

import { init as initTracing } from './tracing';

initTracing();
