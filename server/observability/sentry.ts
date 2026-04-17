import type { Express, ErrorRequestHandler } from 'express';
import logger from '../logger';

// Optional Sentry integration. Dormant until SENTRY_DSN is set and
// @sentry/node is installed. Keeping it optional means we don't pull
// in a ~1MB dep tree for users who don't need error tracking.
//
// To enable:
//   1. npm i @sentry/node (server)
//   2. Set SENTRY_DSN=<your-dsn> in env
//   3. Restart

interface SentryHandlers {
  requestHandler?: () => unknown;
  tracingHandler?: () => unknown;
  errorHandler?: () => ErrorRequestHandler;
}

interface SentrySdk {
  init: (opts: Record<string, unknown>) => void;
  Handlers?: SentryHandlers;
  captureException?: (err: unknown, ctx?: Record<string, unknown>) => void;
}

let sentry: SentrySdk | null = null;
let initialized = false;

export function init(app: Express): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    sentry = require('@sentry/node') as SentrySdk;
  } catch {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed; skipping Sentry init');
    return;
  }

  sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    release: process.env.SENTRY_RELEASE,
  });

  const rh = sentry.Handlers?.requestHandler;
  const th = sentry.Handlers?.tracingHandler;
  if (typeof rh === 'function' && typeof th === 'function') {
    app.use(rh() as never);
    app.use(th() as never);
  }

  logger.info('Sentry initialized', { environment: process.env.NODE_ENV ?? 'unknown' });
}

export function errorHandler(): ErrorRequestHandler {
  const eh = sentry?.Handlers?.errorHandler;
  if (!eh || typeof eh !== 'function') {
    return (err, _req, _res, next) => next(err);
  }
  return eh();
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentry?.captureException) return;
  sentry.captureException(err, { extra: context });
}
