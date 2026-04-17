import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let app: import('express').Express;
let adminToken: string;
let inspectorToken: string;

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  app = (await import('../index')).default;

  const pw = await bcrypt.hash('Correct-Horse-Battery-42', 12);
  await prisma.user.create({
    data: { email: 'admin@audit-ep.test', password: pw, name: 'Admin', role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { email: 'inspector@audit-ep.test', password: pw, name: 'Inspector', role: 'INSPECTOR' },
  });

  const loginAdmin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@audit-ep.test', password: 'Correct-Horse-Battery-42' });
  adminToken = loginAdmin.body.token;

  const loginInspector = await request(app)
    .post('/api/auth/login')
    .send({ email: 'inspector@audit-ep.test', password: 'Correct-Horse-Battery-42' });
  inspectorToken = loginInspector.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/audit-logs', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  it('forbids non-ADMIN roles', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${inspectorToken}`);
    expect(res.status).toBe(403);
  });

  it('returns paginated rows for ADMIN', async () => {
    const res = await request(app)
      .get('/api/audit-logs?limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      limit: 5,
      totalPages: expect.any(Number),
      total: expect.any(Number),
      data: expect.any(Array),
    });
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('decodes previousData / newData JSON strings', async () => {
    const res = await request(app)
      .get('/api/audit-logs?action=LOGIN_SUCCESS&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const row = res.body.data[0];
    expect(row).toBeDefined();
    expect(row.newData).toBeTypeOf('object');
    expect(row.newData.email).toBeDefined();
  });

  it('filters by action', async () => {
    const res = await request(app)
      .get('/api/audit-logs?action=LOGIN_SUCCESS')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.action).toBe('LOGIN_SUCCESS');
    }
  });

  it('ignores unknown action values rather than filtering for them', async () => {
    const res = await request(app)
      .get('/api/audit-logs?action=EVIL_INJECT')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // The unknown filter is dropped, so we get at least some rows back.
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('caps limit at 100', async () => {
    const res = await request(app)
      .get('/api/audit-logs?limit=9999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });
});
