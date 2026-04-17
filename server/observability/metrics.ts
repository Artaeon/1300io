import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'onorm1300_',
});

const httpRequestDuration = new client.Histogram({
  name: 'onorm1300_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'onorm1300_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path
      ? (req.baseUrl ?? '') + req.route.path
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

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}

export { register };
