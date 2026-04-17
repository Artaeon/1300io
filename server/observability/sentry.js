// Optional Sentry integration. Dormant until SENTRY_DSN is set and
// @sentry/node is installed. Keeping it optional means we don't pull
// in a ~1MB dep tree for users who don't need error tracking, and the
// rest of the app stays ignorant of whether Sentry is active.
//
// To enable:
//   1. Install: npm i @sentry/node @sentry/profiling-node (server)
//   2. Set SENTRY_DSN=<your-dsn> in env
//   3. Restart the server
//
// The same pattern exists on the client (see client/src/observability/sentry.js).

const logger = require('../logger');

let sentry = null;
let initialized = false;

function init(app) {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
  } catch {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed; skipping Sentry init');
    return;
  }

  sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    release: process.env.SENTRY_RELEASE,
  });

  if (app && typeof sentry.Handlers?.requestHandler === 'function') {
    app.use(sentry.Handlers.requestHandler());
    app.use(sentry.Handlers.tracingHandler());
  }

  logger.info('Sentry initialized', { environment: process.env.NODE_ENV });
}

function errorHandler() {
  if (!sentry || typeof sentry.Handlers?.errorHandler !== 'function') {
    return (err, req, res, next) => next(err);
  }
  return sentry.Handlers.errorHandler();
}

function captureException(err, context) {
  if (!sentry) return;
  sentry.captureException(err, { extra: context });
}

module.exports = { init, errorHandler, captureException };
