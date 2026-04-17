const express = require('express');
const cors = require('cors');

const logger = require('./logger');
const { config, validateConfig, isProduction } = require('./config');
const prisma = require('./lib/prisma');

const { asyncHandler, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const { enforceHttps, securityHeaders } = require('./middleware/security');
const { originCheck } = require('./middleware/originCheck');
const { globalLimiter, loginLimiter } = require('./middleware/rateLimiters');
const { uploadDir } = require('./middleware/uploadHandler');

const sentry = require('./observability/sentry');
const { metricsMiddleware, metricsHandler } = require('./observability/metrics');

const authRoutes = require('./routes/auth');
const docsRoutes = require('./routes/docs');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const propertyRoutes = require('./routes/properties');
const inspectionRoutes = require('./routes/inspections');
const checklistRoutes = require('./routes/checklist');
const uploadRoutes = require('./routes/upload');
const exportRoutes = require('./routes/exports');

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

app.use(cors({
  origin: isProduction ? config.frontendUrl : true,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));

app.use(originCheck);
app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files (static)
app.use('/uploads', express.static(uploadDir));

// --- Health + metrics ---
app.get('/', (req, res) => {
  res.json({ name: '1300.io API', status: 'running' });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ready', db: 'connected' });
}));

app.get('/health', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', db: 'connected' });
}));

app.get('/metrics', asyncHandler(async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (isProduction && token) {
    const auth = req.get('authorization');
    if (auth !== `Bearer ${token}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  return metricsHandler(req, res);
}));

// --- API routes ---
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
// Swagger UI needs inline script/style; relax CSP just for /api/docs.
app.use('/api/docs', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  );
  next();
});
app.use('/api', docsRoutes); // /api/docs (Swagger UI) + /api/openapi.json
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/inspections', exportRoutes); // /:id/export/csv + /:id/pdf
app.use('/api/checklist', checklistRoutes);
app.use('/api/upload', uploadRoutes);

// --- 404 + error handling (must come after all routes) ---
app.use(notFoundHandler);
app.use(sentry.errorHandler());
app.use(errorHandler);

// --- Start server ---
if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`1300.io API running on port ${config.port} (${config.nodeEnv})`);
  });
}

module.exports = app;
