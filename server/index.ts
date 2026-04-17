import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';

import logger from './logger';
import { config, validateConfig, isProduction } from './config';
import prisma from './lib/prisma';
import { release } from './lib/version';

import { asyncHandler, errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { enforceHttps, securityHeaders } from './middleware/security';
import { originCheck } from './middleware/originCheck';
import { globalLimiter, loginLimiter } from './middleware/rateLimiters';
import { checkLockout } from './middleware/accountLockout';
import { uploadDir } from './middleware/uploadHandler';

import * as sentry from './observability/sentry';
import { metricsMiddleware, metricsHandler } from './observability/metrics';

import authRoutes from './routes/auth';
import auditLogRoutes from './routes/auditLogs';
import docsRoutes from './routes/docs';
import userRoutes from './routes/users';
import organizationRoutes from './routes/organizations';
import propertyRoutes from './routes/properties';
import inspectionRoutes from './routes/inspections';
import checklistRoutes from './routes/checklist';
import uploadRoutes from './routes/upload';
import exportRoutes from './routes/exports';

validateConfig();

const app = express();

// Must run before any other middleware so Sentry can wrap requests.
sentry.init(app);

// Trust one upstream proxy (nginx/LB) so req.ip and req.secure reflect
// the real client. Tighten this number if traffic is behind more hops.
app.set('trust proxy', 1);

// --- Core middleware ---
app.use(requestId);
app.use(metricsMiddleware);
app.use(enforceHttps);
app.use(securityHeaders());
app.disable('x-powered-by');

app.use(
  cors({
    origin: isProduction ? config.frontendUrl : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  }),
);

app.use(originCheck);
app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files (static)
app.use('/uploads', express.static(uploadDir));

// --- Health + metrics ---
// /health, /healthz, /readyz are distinct on purpose:
//   /healthz  → liveness (always cheap, no DB)
//   /readyz   → readiness (verifies DB + flips 503 on shutdown)
//   /health   → human-friendly bundle of both plus release metadata
app.get('/', (_req, res) => {
  res.json({ name: '1300.io API', status: 'running' });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get(
  '/readyz',
  asyncHandler(async (_req, res) => {
    if (app.locals.shuttingDown) {
      res.status(503).json({ status: 'shutting_down' });
      return;
    }
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', db: 'connected' });
  }),
);

app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const started = new Date(release.startedAt).getTime();
    const uptimeSeconds = Math.floor((Date.now() - started) / 1000);
    let db = 'unknown';
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'connected';
    } catch {
      db = 'down';
    }
    res.json({
      status: db === 'connected' ? 'ok' : 'degraded',
      db,
      version: release.version,
      sha: release.sha,
      nodeEnv: release.nodeEnv,
      startedAt: release.startedAt,
      uptimeSeconds,
    });
  }),
);

// Public version endpoint — used by the client footer to show which
// build users are running (useful for support tickets). No DB touch
// and no auth so it's cheap to scrape.
app.get('/api/version', (_req, res) => {
  res.json({ version: release.version, sha: release.sha });
});

app.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    const token = process.env.METRICS_TOKEN;
    if (isProduction && token) {
      const auth = req.get('authorization');
      if (auth !== `Bearer ${token}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }
    await metricsHandler(req, res);
  }),
);

// --- API routes ---
// Login request pipeline: first IP-based rate limiter (cheap, stops
// brute-force from a single source), then per-email lockout (handles
// credential-stuffing across rotating IPs).
app.use('/api/auth/login', loginLimiter, checkLockout);
app.use('/api/auth', authRoutes);

// Swagger UI needs inline script/style; relax CSP just for /api/docs.
app.use('/api/docs', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
  );
  next();
});
app.use('/api', docsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/inspections', exportRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// --- 404 + error handling (must come after all routes) ---
app.use(notFoundHandler);
app.use(sentry.errorHandler());
app.use(errorHandler);

// --- Start server ---
if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info(`1300.io API running on port ${config.port} (${config.nodeEnv})`);
  });

  // --- Graceful shutdown ---
  const SHUTDOWN_TIMEOUT_MS = 25_000;
  let shuttingDown = false;

  type ShutdownSignal = 'SIGTERM' | 'SIGINT' | 'uncaughtException' | 'unhandledRejection';

  function shutdown(signal: ShutdownSignal): void {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    app.locals.shuttingDown = true;

    const forceExit = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async (err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
      }
      try {
        await prisma.$disconnect();
      } catch (e) {
        logger.error('Error disconnecting Prisma', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      clearTimeout(forceExit);
      process.exit(err ? 1 : 0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal('uncaughtException', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal('unhandledRejection', { reason: String(reason) });
    shutdown('unhandledRejection');
  });
}

export default app;
