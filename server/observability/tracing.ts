import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, context as otelContext, type Span, SpanKind } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import logger from '../logger';
import { release } from '../lib/version';

/**
 * OpenTelemetry tracing.
 *
 * Opt-in via OTEL_EXPORTER_OTLP_ENDPOINT. If unset, nothing starts —
 * no SDK loaded, no instrumentation attached, no cost.
 *
 * When enabled, auto-instrumentations cover http, express, prisma,
 * and pg; OTLP/HTTP traces ship to the configured collector.
 *
 * Custom spans can be created via trace.getTracer('onorm1300') in
 * any handler, and we export `setRequestIdAttribute` to correlate
 * each span with our X-Request-Id.
 */

let sdk: NodeSDK | null = null;

export function init(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;

  try {
    const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
    const exporter = new OTLPTraceExporter({
      url: `${endpoint.replace(/\/+$/, '')}/v1/traces`,
      headers,
    });

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'onorm1300-server',
      [ATTR_SERVICE_VERSION]: release.version,
      'deployment.environment.name': release.nodeEnv,
      'service.instance.id': `${release.version}-${release.sha}`,
    });

    sdk = new NodeSDK({
      resource,
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Don't instrument fs; it's noisy and rarely useful in a
          // request-oriented service.
          '@opentelemetry/instrumentation-fs': { enabled: false },
          // Express instrumentation captures route spans.
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
        }),
      ],
    });

    sdk.start();
    logger.info('OpenTelemetry tracing started', {
      endpoint,
      service: process.env.OTEL_SERVICE_NAME ?? 'onorm1300-server',
    });

    // Flush spans on shutdown so we don't drop the last few.
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('OpenTelemetry init failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function shutdown(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch (err) {
    logger.warn('OpenTelemetry shutdown error', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    sdk = null;
  }
}

function parseHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const out: Record<string, string> = {};
  // Accept the W3C form: `key1=val1,key2=val2`
  for (const pair of raw.split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Middleware: attach our X-Request-Id as a span attribute on the
 * ambient HTTP span. Lets us grep across traces + log lines using
 * the same correlation id.
 *
 * No-op when OTel is not initialized.
 */
export function attachRequestIdAttribute(req: Request, _res: Response, next: NextFunction): void {
  const span = trace.getSpan(otelContext.active());
  if (span && req.id) {
    span.setAttribute('request.id', req.id);
    if (req.user?.userId) span.setAttribute('enduser.id', req.user.userId);
  }
  next();
}

/**
 * Optional helper: start a custom span around an async block. Used
 * for expensive work (PDF render, image optimize) where a sub-span
 * makes the flame graph legible.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attrs: Record<string, string | number | boolean> = {},
): Promise<T> {
  const tracer = trace.getTracer('onorm1300');
  return tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL, attributes: attrs }, async (span) => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2 /* ERROR */ });
      span.end();
      throw err;
    }
  });
}
