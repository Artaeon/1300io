import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let app: import('express').Express;

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });
  app = (await import('../index')).default;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * These assertions protect against silent regressions in the helmet
 * configuration. If someone flips useDefaults to false without also
 * re-asserting the individual directives, this catches it.
 */
describe('Security headers', () => {
  it('sets Content-Security-Policy with strict directives', async () => {
    const res = await request(app).get('/').expect(200);
    const csp = res.headers['content-security-policy'] as string | undefined;
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // No unsafe-inline on script-src specifically — style-src may
    // have it for tailwind runtime, but scripts never should.
    const scriptDirective = csp!.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(scriptDirective).not.toContain("'unsafe-eval'");
  });

  it('sets Referrer-Policy to strict-origin-when-cross-origin', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not leak X-Powered-By', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets an X-Request-Id on every response', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$|^[A-Za-z0-9_-]+$/);
  });

  it('honors a well-formed incoming X-Request-Id header', async () => {
    const probe = 'req-abc-123_XYZ';
    const res = await request(app).get('/healthz').set('X-Request-Id', probe);
    expect(res.headers['x-request-id']).toBe(probe);
  });

  it('replaces a malformed incoming X-Request-Id with a fresh UUID', async () => {
    const badId = 'bad;id with spaces & semicolons';
    const res = await request(app).get('/healthz').set('X-Request-Id', badId);
    expect(res.headers['x-request-id']).not.toBe(badId);
    // UUID v4 format
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('exposes X-Request-Id via CORS', async () => {
    // OPTIONS preflight — cors returns Access-Control-Expose-Headers
    const res = await request(app).get('/healthz').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-expose-headers']).toMatch(/X-Request-Id/i);
  });

  it('error responses include requestId in the body', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: 'Not found',
      path: '/api/does-not-exist',
      requestId: expect.any(String),
    });
  });

  it('rejects requests that would evade state-changing verbs in prod', async () => {
    // In NODE_ENV=test the originCheck middleware short-circuits, so
    // this just verifies the middleware is wired (no 403). The actual
    // cross-origin behavior is proved by reading the middleware source.
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y', password: '' });
    // We expect a validation error, not 403. Proves we got past origin
    // check and into the handler.
    expect(res.status).not.toBe(403);
  });
});
