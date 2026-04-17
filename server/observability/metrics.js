const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'onorm1300_',
});

const httpRequestDuration = new client.Histogram({
  name: 'onorm1300_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'onorm1300_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    // Prefer the matched route path (e.g. /api/properties/:id) over the
    // raw URL to keep cardinality bounded.
    const route = req.route?.path
      ? (req.baseUrl || '') + req.route.path
      : 'unknown';
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });
  next();
}

async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, register };
