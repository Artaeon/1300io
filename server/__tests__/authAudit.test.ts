import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let app: import('express').Express;
let adminToken: string;

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  app = (await import('../index')).default;

  const pw = await bcrypt.hash('Correct-Horse-Battery-42', 12);
  await prisma.user.create({
    data: { email: 'admin@audit.test', password: pw, name: 'Audit Admin', role: 'ADMIN' },
  });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@audit.test', password: 'Correct-Horse-Battery-42' });
  adminToken = login.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function fetchAuditRows(action: string) {
  const res = await request(app)
    .get(`/api/audit-logs?action=${action}&limit=100`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  return res.body.data;
}

describe('auth audit events', () => {
  it('LOGIN_SUCCESS is recorded on successful login', async () => {
    const rows = await fetchAuditRows('LOGIN_SUCCESS');
    // The admin's own login during beforeAll produced one.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const first = rows.find((r: { newData: { email?: string } }) => r.newData?.email === 'admin@audit.test');
    expect(first).toBeTruthy();
    expect(first.newData.refreshTokenPrefix).toMatch(/…$/);
  });

  it('LOGIN_FAILURE is recorded for bad password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@audit.test', password: 'wrong-password-12' })
      .expect(401);

    const rows = await fetchAuditRows('LOGIN_FAILURE');
    const recent = rows.find((r: { newData: { email?: string; reason?: string } }) =>
      r.newData?.email === 'admin@audit.test' && r.newData?.reason === 'bad_password',
    );
    expect(recent).toBeTruthy();
  });

  it('LOGIN_FAILURE is recorded for unknown email (no info leak to client)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@nowhere.test', password: 'Doesnt-Matter-42' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials'); // same message as wrong password

    const rows = await fetchAuditRows('LOGIN_FAILURE');
    const recent = rows.find((r: { newData: { email?: string; reason?: string } }) =>
      r.newData?.email === 'ghost@nowhere.test' && r.newData?.reason === 'unknown_user',
    );
    expect(recent).toBeTruthy();
  });

  it('LOGIN_FAILURE newData never contains the attempted password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@audit.test', password: 'very-specific-probe-123' });

    const rows = await fetchAuditRows('LOGIN_FAILURE');
    for (const row of rows) {
      const blob = JSON.stringify(row.newData ?? {});
      expect(blob).not.toContain('very-specific-probe-123');
    }
  });

  it('LOGOUT is recorded and tied to the userId', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@audit.test', password: 'Correct-Horse-Battery-42' });
    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: login.body.refreshToken });

    const rows = await fetchAuditRows('LOGOUT');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const latest = rows[0];
    expect(latest.userId).toBeTypeOf('number');
  });

  it('TOKEN_REFRESH is recorded on successful refresh', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@audit.test', password: 'Correct-Horse-Battery-42' });
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    const rows = await fetchAuditRows('TOKEN_REFRESH');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('invalid refresh token is audited as LOGIN_FAILURE with the right reason', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'deadbeef-this-is-not-a-real-token' })
      .expect(401);

    const rows = await fetchAuditRows('LOGIN_FAILURE');
    const match = rows.find((r: { newData: { reason?: string } }) => r.newData?.reason === 'invalid_refresh_token');
    expect(match).toBeTruthy();
  });
});
