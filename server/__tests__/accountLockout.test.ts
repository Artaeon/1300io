import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
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
  app = require('../index');
  const pw = await bcrypt.hash('Correct-Horse-Battery-42', 12);
  await prisma.user.create({
    data: { email: 'target@lockout.test', password: pw, name: 'Target', role: 'INSPECTOR' },
  });
});

beforeEach(async () => {
  // Wipe audit log between tests so the 10-failure threshold is
  // reset per-test — otherwise test ordering affects results.
  await prisma.auditLog.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('account lockout', () => {
  it('allows up to 9 failed attempts, then locks on the 10th', async () => {
    for (let i = 0; i < 9; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@lockout.test', password: `wrong-${i}-pass` });
      expect(res.status).toBe(401);
    }

    // 10th failure flips into locked territory on the next request.
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'target@lockout.test', password: 'wrong-final-pass' })
      .expect(401);

    const locked = await request(app)
      .post('/api/auth/login')
      .send({ email: 'target@lockout.test', password: 'Correct-Horse-Battery-42' });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/15 Minuten/);
  });

  it('writes an ACCOUNT_LOCKED audit row exactly once per window', async () => {
    for (let i = 0; i < 12; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@lockout.test', password: `bad-${i}` });
    }

    const locked = await prisma.auditLog.findMany({
      where: { action: 'ACCOUNT_LOCKED' },
    });
    expect(locked.length).toBe(1);
  });

  it('lockout is per-email, not global — other accounts unaffected', async () => {
    const pw = await bcrypt.hash('Strong-Other-Pass-42', 12);
    await prisma.user.create({
      data: { email: 'other@lockout.test', password: pw, name: 'Other', role: 'INSPECTOR' },
    });

    for (let i = 0; i < 11; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@lockout.test', password: `bad-${i}` });
    }

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'other@lockout.test', password: 'Strong-Other-Pass-42' });
    expect(ok.status).toBe(200);
  });
});
